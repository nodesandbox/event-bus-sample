// services/payment-service/src/index.ts
import express, { Request, Response } from 'express';
import { RabbitMQEventBus, EventFactory } from '@digitaltg/event-bus';
import { RABBITMQ_URL, SERVICES } from '../../shared/config';
import { PaymentData } from '../../shared/types';
import { PaymentEventType } from '../../shared/events';

const app = express();
app.use(express.json());

const payments: Array<{ paymentId: string; orderId: string; status: 'SUCCESS' | 'FAILED'; amount: number }> = [];

const eventBus = new RabbitMQEventBus<PaymentEventType>({
  connection: { url: RABBITMQ_URL },
});

const start = async () => {
  await eventBus.init();
  console.log(`[Payment Service] Connected to RabbitMQ and initialized successfully`);

  await eventBus.subscribe(
    [PaymentEventType.PAYMENT_INITIATED],
    async (event) => {
      const { orderId, amount, paymentId } = event.data as PaymentData;
      console.log(`[Payment Service] Received PAYMENT_INITIATED event for orderId: ${orderId}`, event.data);

      const isSuccess = Math.random() > 0.2; // 80% chance of success
      const status = isSuccess ? 'SUCCESS' : 'FAILED';
      console.log(`[Payment Service] Processing payment for orderId: ${orderId} with paymentId: ${paymentId}. Success: ${isSuccess}`);

      payments.push({ paymentId, orderId, status, amount });
      console.log(`[Payment Service] Payment status recorded for paymentId: ${paymentId}, status: ${status}`);

      if (isSuccess) {
        const paymentSucceededEvent = EventFactory.create<{ orderId: string; paymentId: string }, PaymentEventType>(
          PaymentEventType.PAYMENT_SUCCEEDED,
          { orderId, paymentId },
          SERVICES.PAYMENT.NAME
        );
        console.log(`[Payment Service] Publishing PAYMENT_SUCCEEDED event for orderId: ${orderId}`, paymentSucceededEvent);
        await eventBus.publish(paymentSucceededEvent);
      } else {
        const paymentFailedEvent = EventFactory.create<{ orderId: string; paymentId: string }, PaymentEventType>(
          PaymentEventType.PAYMENT_FAILED,
          { orderId, paymentId },
          SERVICES.PAYMENT.NAME
        );
        console.log(`[Payment Service] Publishing PAYMENT_FAILED event for orderId: ${orderId}`, paymentFailedEvent);
        await eventBus.publish(paymentFailedEvent);
      }
    }
  );

  app.get('/payments/:paymentId', (req: Request<{ paymentId: string }>, res: Response) => {
    console.log(`[Payment Service] Retrieving payment information for paymentId: ${req.params.paymentId}`);
    const payment = payments.find((p) => p.paymentId === req.params.paymentId);
    if (!payment) {
      console.warn(`[Payment Service] Payment not found for paymentId: ${req.params.paymentId}`);
      res.status(404).json({ error: 'Payment not found' });
      return;
    }
    res.json(payment);
  });

  app.listen(SERVICES.PAYMENT.PORT, () => {
    console.log(`[Payment Service] Running on port ${SERVICES.PAYMENT.PORT}`);
  });
};

start().catch((error) => {
  console.error(`[Payment Service] Failed to start service:`, error);
});
