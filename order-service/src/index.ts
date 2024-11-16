import express, { Request, Response } from 'express';
import { RabbitMQEventBus, EventFactory } from '@nodesandbox/event-bus';
import { v4 as uuid } from 'uuid';
import { RABBITMQ_URL, SERVICES } from '../../shared/config';
import { OrderData, PaymentData, StockData, StockCheckResponse } from '../../shared/types';
import { EventType, OrderEventType, PaymentEventType, StockEventType } from '../../shared/events';

interface CreateOrderRequest {
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
}

interface OrderParams {
  orderId: string;
}

const app = express();
app.use(express.json());

const orders = new Map<string, OrderData>();
const eventBus = new RabbitMQEventBus<EventType>({
  connection: { url: RABBITMQ_URL }
});

const start = async () => {
  await eventBus.init();

  await eventBus.subscribe(
    [
      StockEventType.STOCK_CHECK_RESPONSE,
      StockEventType.STOCK_RESERVED,
      PaymentEventType.PAYMENT_SUCCEEDED,
      PaymentEventType.PAYMENT_FAILED
    ],
    async (event) => {
      const orderId = (event.data as { orderId: string }).orderId;
      const order = orders.get(orderId);
      
      console.log(`[Order Service] Received event: ${event.type} for orderId: ${orderId}`, event.data);

      if (!order) {
        console.warn(`[Order Service] Order with orderId: ${orderId} not found`);
        return;
      }

      switch (event.type) {
        case StockEventType.STOCK_CHECK_RESPONSE:
          if (order.status !== 'PENDING') {
            console.warn(`[Order Service] Ignoring STOCK_CHECK_RESPONSE for orderId: ${orderId} as status is ${order.status}`);
            return;
          }
          const stockResponse = event.data as StockCheckResponse;
          console.log(`[Order Service] Processing STOCK_CHECK_RESPONSE for orderId: ${orderId}`, stockResponse);
          if (!stockResponse.available) {
            console.warn(`[Order Service] Stock unavailable for orderId: ${orderId}. Marking as FAILED.`);
            orders.set(orderId, { ...order, status: 'FAILED' });
            const failedEvent = EventFactory.create<{ orderId: string }, OrderEventType>(
              OrderEventType.ORDER_FAILED,
              { orderId },
              SERVICES.ORDER.NAME
            );
            console.log(`[Order Service] Publishing ORDER_FAILED event for orderId: ${orderId}`, failedEvent);
            await eventBus.publish(failedEvent);
          }
          // Si `available` est `true`, `order-service` attend `STOCK_RESERVED` de `inventory-service`.
          break;

        case StockEventType.STOCK_RESERVED:
          if (order.status !== 'PENDING') {
            console.warn(`[Order Service] Ignoring STOCK_RESERVED for orderId: ${orderId} as status is ${order.status}`);
            return;
          }
          console.log(`[Order Service] Processing STOCK_RESERVED for orderId: ${orderId}`);
          const paymentEvent = EventFactory.create<PaymentData, PaymentEventType>(
            PaymentEventType.PAYMENT_INITIATED,
            {
              orderId,
              amount: order.totalAmount,
              paymentId: uuid()
            },
            SERVICES.ORDER.NAME
          );
          console.log(`[Order Service] Publishing PAYMENT_INITIATED event for orderId: ${orderId}`, paymentEvent);
          await eventBus.publish(paymentEvent);
          break;

        case PaymentEventType.PAYMENT_SUCCEEDED:
          if (order.status !== 'PENDING') {
            console.warn(`[Order Service] Ignoring PAYMENT_SUCCEEDED for orderId: ${orderId} as status is ${order.status}`);
            return;
          }
          console.log(`[Order Service] Processing PAYMENT_SUCCEEDED for orderId: ${orderId}`);
          orders.set(orderId, { ...order, status: 'COMPLETED' });
          const completedEvent = EventFactory.create<OrderData,OrderEventType>(
            OrderEventType.ORDER_COMPLETED,
            { ...order, status: 'COMPLETED' },
            SERVICES.ORDER.NAME
          );
          console.log(`[Order Service] Publishing ORDER_COMPLETED event for orderId: ${orderId}`, completedEvent);
          await eventBus.publish(completedEvent);
          break;

        case PaymentEventType.PAYMENT_FAILED:
          if (order.status !== 'PENDING') {
            console.warn(`[Order Service] Ignoring PAYMENT_FAILED for orderId: ${orderId} as status is ${order.status}`);
            return;
          }
          console.warn(`[Order Service] Payment failed for orderId: ${orderId}. Marking as FAILED.`);
          orders.set(orderId, { ...order, status: 'FAILED' });
          const failedEvent = EventFactory.create<{ orderId: string }, OrderEventType>(
            OrderEventType.ORDER_FAILED,
            { orderId },
            SERVICES.ORDER.NAME
          );
          console.log(`[Order Service] Publishing ORDER_FAILED event for orderId: ${orderId}`, failedEvent);
          await eventBus.publish(failedEvent);

          const releaseStockEvent = EventFactory.create<StockData, StockEventType>(
            StockEventType.STOCK_RELEASED,
            {
              orderId,
              items: order.items.map(item => ({
                productId: item.productId,
                quantity: item.quantity
              }))
            },
            SERVICES.ORDER.NAME
          );
          console.log(`[Order Service] Publishing STOCK_RELEASED event for orderId: ${orderId}`, releaseStockEvent);
          await eventBus.publish(releaseStockEvent);
          break;
      }
    }
  );

  app.post('/orders', async (
    req: Request<{}, {}, CreateOrderRequest>,
    res: Response
  ): Promise<void> => {
    const orderId = uuid();
    const { userId, items } = req.body;

    const totalAmount = items.reduce(
      (sum: number, item) => sum + (item.price * item.quantity),
      0
    );
    
    const order: OrderData = {
      orderId,
      userId,
      items,
      totalAmount,
      status: 'PENDING'
    };

    orders.set(orderId, order);
    console.log(`[Order Service] Created new order with orderId: ${orderId}`, order);

    const orderCreatedEvent = EventFactory.create<OrderData, OrderEventType>(
      OrderEventType.ORDER_CREATED,
      order,
      SERVICES.ORDER.NAME
    );
    console.log(`[Order Service] Publishing ORDER_CREATED event for orderId: ${orderId}`, orderCreatedEvent);
    await eventBus.publish(orderCreatedEvent);

    const stockCheckEvent = EventFactory.create<StockData, StockEventType>(
      StockEventType.STOCK_CHECK,
      {
        orderId,
        items: items.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      },
      SERVICES.ORDER.NAME
    );
    console.log(`[Order Service] Publishing STOCK_CHECK event for orderId: ${orderId}`, stockCheckEvent);
    await eventBus.publish(stockCheckEvent);
    
    res.status(201).json({ orderId });
  });

  app.get('/orders/:orderId', (
    req: Request<OrderParams>,
    res: Response
  ): void => {
    const order = orders.get(req.params.orderId);
    if (!order) {
      console.warn(`[Order Service] Order not found for orderId: ${req.params.orderId}`);
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    console.log(`[Order Service] Retrieved order for orderId: ${req.params.orderId}`, order);
    res.json(order);
  });

  app.listen(SERVICES.ORDER.PORT, () => {
    console.log(`${SERVICES.ORDER.NAME} running on port ${SERVICES.ORDER.PORT}`);
  });
};

start().catch(error => {
  console.error(`[Order Service] Failed to start service:`, error);
});
