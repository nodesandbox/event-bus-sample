// services/notification-service/src/index.ts
import express, { Request, Response } from 'express';
import { RabbitMQEventBus, EventFactory } from '@digitaltg/event-bus';
import { RABBITMQ_URL, SERVICES } from '../../shared/config';
import { OrderData } from '../../shared/types';
import { EventType, OrderEventType, PaymentEventType } from '../../shared/events';

const app = express();
app.use(express.json());

// Simple storage for notifications
const notifications: Array<{ id: number; timestamp: string; type: string; message: string }> = [];

const eventBus = new RabbitMQEventBus<EventType>({
  connection: { url: RABBITMQ_URL },
});

const start = async () => {
  await eventBus.init();
  console.log(`[Notification Service] Connected to RabbitMQ and initialized successfully`);

  await eventBus.subscribe(
    [
      OrderEventType.ORDER_CREATED,
      OrderEventType.ORDER_COMPLETED,
      OrderEventType.ORDER_FAILED,
      PaymentEventType.PAYMENT_SUCCEEDED,
      PaymentEventType.PAYMENT_FAILED,
    ],
    async (event) => {
      console.log(`[Notification Service] Received event: ${event.type}`, event.data);

      const notification = {
        id: notifications.length + 1,
        timestamp: new Date().toISOString(),
        type: event.type,
        message: '',
      };

      switch (event.type) {
        case OrderEventType.ORDER_CREATED:
          notification.message = `Nouvelle commande créée : ${(event.data as OrderData).orderId}`;
          console.log(`[Notification Service] Processed ORDER_CREATED for orderId: ${(event.data as OrderData).orderId}`);
          break;

        case OrderEventType.ORDER_COMPLETED:
          notification.message = `Commande complétée : ${(event.data as OrderData).orderId}`;
          console.log(`[Notification Service] Processed ORDER_COMPLETED for orderId: ${(event.data as OrderData).orderId}`);
          break;

        case OrderEventType.ORDER_FAILED:
          notification.message = `Échec de la commande : ${(event.data as { orderId: string }).orderId}`;
          console.log(`[Notification Service] Processed ORDER_FAILED for orderId: ${(event.data as { orderId: string }).orderId}`);
          break;

        case PaymentEventType.PAYMENT_SUCCEEDED:
          notification.message = `Paiement réussi pour la commande : ${(event.data as { orderId: string }).orderId}`;
          console.log(`[Notification Service] Processed PAYMENT_SUCCEEDED for orderId: ${(event.data as { orderId: string }).orderId}`);
          break;

        case PaymentEventType.PAYMENT_FAILED:
          notification.message = `Échec du paiement pour la commande : ${(event.data as { orderId: string }).orderId}`;
          console.log(`[Notification Service] Processed PAYMENT_FAILED for orderId: ${(event.data as { orderId: string }).orderId}`);
          break;
      }

      notifications.push(notification);
      console.log('📧 Notification:', notification.message);
    }
  );

  // API to retrieve notifications
  app.get('/notifications', (req: Request, res: Response) => {
    console.log(`[Notification Service] Received request for all notifications`);
    res.json(notifications);
  });

  app.listen(SERVICES.NOTIFICATION.PORT, () => {
    console.log(`${SERVICES.NOTIFICATION.NAME} running on port ${SERVICES.NOTIFICATION.PORT}`);
  });
};

start().catch((error) => {
  console.error(`[Notification Service] Failed to start service:`, error);
});
