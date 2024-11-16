export const RABBITMQ_URL = 'amqp://localhost:5672';
export const QUEUE_NAME = 'sample-eda-ecom-events';

export const SERVICES = {
  ORDER: {
    NAME: 'order-service',
    PORT: 3001
  },
  INVENTORY: {
    NAME: 'inventory-service',
    PORT: 3002
  },
  PAYMENT: {
    NAME: 'payment-service',
    PORT: 3003
  },
  NOTIFICATION: {
    NAME: 'notification-service',
    PORT: 3004
  }
} as const;