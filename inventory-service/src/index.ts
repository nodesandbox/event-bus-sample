import express, { Request, Response } from 'express';
import { RabbitMQEventBus, EventFactory } from '@nodesandbox/event-bus';
import { RABBITMQ_URL, SERVICES } from '../../shared/config';
import { StockData, StockCheckResponse, OrderItem } from '../../shared/types';
import { EventType, OrderEventType, StockEventType } from '../../shared/events';

const app = express();
app.use(express.json());

// Simulated inventory database
const inventory = new Map<string, { id: string; name: string; stock: number }>([
  ['PROD1', { id: 'PROD1', name: 'Laptop', stock: 10 }],
  ['PROD2', { id: 'PROD2', name: 'Phone', stock: 20 }],
]);

const eventBus = new RabbitMQEventBus<EventType>({
  connection: { url: RABBITMQ_URL },
});

const start = async () => {
  await eventBus.init();

  // Subscribe to relevant events
  await eventBus.subscribe(
    [OrderEventType.ORDER_FAILED, StockEventType.STOCK_RELEASED, StockEventType.STOCK_CHECK],
    async (event) => {
      console.log(`[Inventory Service] Received event: ${event.type}`, event.data);

      switch (event.type) {
        case StockEventType.STOCK_CHECK:
          const checkOrderId = (event.data as { orderId: string }).orderId;
          const checkItems: OrderItem[] = (event.data as { items: OrderItem[] }).items;
          console.log(`[Inventory Service] Checking stock for orderId: ${checkOrderId}`, checkItems);

          let allItemsAvailable = true;
          const unavailableItems: Array<{ productId: string; available: boolean; currentStock: number }> = [];

          // Vérifiez la disponibilité de chaque produit
          for (const item of checkItems) {
            const product = inventory.get(item.productId);
            if (!product || product.stock < item.quantity) {
              allItemsAvailable = false;
              unavailableItems.push({
                productId: item.productId,
                available: false,
                currentStock: product ? product.stock : 0,
              });
            }
          }

          // Publiez STOCK_CHECK_RESPONSE pour informer de la disponibilité
          const stockCheckResponseEvent = EventFactory.create<StockCheckResponse, StockEventType>(
            StockEventType.STOCK_CHECK_RESPONSE,
            {
              orderId: checkOrderId,
              available: allItemsAvailable,
              items: unavailableItems.length ? unavailableItems : checkItems.map(item => ({
                productId: item.productId,
                available: true,
                currentStock: inventory.get(item.productId)?.stock ?? 0,
              })),
            },
            SERVICES.INVENTORY.NAME
          );
          console.log(`[Inventory Service] Publishing STOCK_CHECK_RESPONSE for orderId: ${checkOrderId}`, stockCheckResponseEvent);
          await eventBus.publish(stockCheckResponseEvent);

          // Si tout est disponible, réservez immédiatement le stock et publiez STOCK_RESERVED
          if (allItemsAvailable) {
            checkItems.forEach((item) => {
              const product = inventory.get(item.productId);
              if (product) {
                product.stock -= item.quantity;
                inventory.set(item.productId, product);
              }
            });
            const stockReservedEvent = EventFactory.create<StockData, StockEventType>(
              StockEventType.STOCK_RESERVED,
              { orderId: checkOrderId, items: checkItems },
              SERVICES.INVENTORY.NAME
            );
            console.log(`[Inventory Service] Publishing STOCK_RESERVED for orderId: ${checkOrderId}`, stockReservedEvent);
            await eventBus.publish(stockReservedEvent);
          } else {
            console.warn(`[Inventory Service] Stock unavailable for orderId: ${checkOrderId}`, unavailableItems);
          }
          break;

        case OrderEventType.ORDER_FAILED:
          const failedOrderId = (event.data as { orderId: string }).orderId;
          const failedItems = (event.data as { items?: OrderItem[] }).items;
          console.log(`[Inventory Service] Releasing stock for failed orderId: ${failedOrderId}`, failedItems);

          if (failedItems) {
            failedItems.forEach((item) => {
              const product = inventory.get(item.productId);
              if (product) {
                product.stock += item.quantity;
                inventory.set(item.productId, product);
              }
            });
          } else {
            console.warn(`[Inventory Service] No items found to release for ORDER_FAILED event with orderId: ${failedOrderId}`);
          }
          break;

        case StockEventType.STOCK_RELEASED:
          const releaseOrderId = (event.data as { orderId: string }).orderId;
          const releaseItems = (event.data as { items?: OrderItem[] }).items;
          console.log(`[Inventory Service] Releasing stock for orderId: ${releaseOrderId}`, releaseItems);

          if (releaseItems) {
            releaseItems.forEach((item) => {
              const product = inventory.get(item.productId);
              if (product) {
                product.stock += item.quantity;
                inventory.set(item.productId, product);
              }
            });
          } else {
            console.warn(`[Inventory Service] No items found to release for STOCK_RELEASED event with orderId: ${releaseOrderId}`);
          }
          break;
      }
    }
  );

  // API to check inventory
  app.get('/inventory', (req: Request, res: Response) => {
    res.json(Array.from(inventory.values()));
  });

  app.listen(SERVICES.INVENTORY.PORT, () => {
    console.log(`${SERVICES.INVENTORY.NAME} running on port ${SERVICES.INVENTORY.PORT}`);
  });
};

start().catch(error => {
  console.error(`[Inventory Service] Failed to start service:`, error);
});
