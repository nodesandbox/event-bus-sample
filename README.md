# RabbitMQ Event Bus Sample Project

This repository demonstrates the practical usage of the `@nodesandbox/event-bus` package through an e-commerce ecosystem. The sample project implements an **event-driven architecture** where services communicate asynchronously via RabbitMQ.

## Overview

The system simulates an e-commerce platform with the following services:

- **Order Service**:
  - Handles order creation and updates.
  - Publishes events like `order.created` and `stock.check`.
  - Consumes events like `stock.check.response`, `stock.reserved`, and payment events.

- **Inventory Service**:
  - Manages stock availability and updates.
  - Subscribes to events like `stock.check`, `order.failed`, and `stock.released`.
  - Publishes responses like `stock.check.response` and `stock.reserved`.

- **Payment Service**:
  - Simulates payment processing.
  - Subscribes to `payment.initiated` events.
  - Publishes `payment.succeeded` or `payment.failed` events.

- **Notification Service**:
  - Sends notifications based on various events.
  - Subscribes to events such as `order.created`, `order.completed`, `payment.succeeded`, and more.

---

## Features Demonstrated

- **Event-Driven Communication**: Services exchange events using RabbitMQ as the message broker.
- **Event Persistence**: Ensures that messages are retained until successfully consumed.
- **Dead Letter Queue (DLQ)**: Captures unroutable or unprocessed messages for debugging or retries.
- **Service Decoupling**: Each service operates independently, making the architecture scalable and fault-tolerant.

---

## Architecture

```text
+---------------+      +-----------------+      +------------------+      +-------------------+
|   Order       | ---> |   Inventory     | ---> |    Payment       | ---> |   Notification    |
|   Service     |      |   Service       |      |    Service       |      |   Service          |
+---------------+      +-----------------+      +------------------+      +-------------------+
```

Each service is a separate Node.js application communicating via RabbitMQ, using the `@nodesandbox/event-bus` package.

---

## Project Structure

```
sample-project/
├── shared/
│   ├── config.ts       # Shared configurations (RabbitMQ URL, service ports)
│   ├── events.ts       # Shared event types
│   ├── types.ts        # Shared data models
├── order-service/      # Order service implementation
├── inventory-service/  # Inventory service implementation
├── payment-service/    # Payment service implementation
└── notification-service/ # Notification service implementation
```

---

## Getting Started

### Prerequisites

- **Node.js**: Version 14+.
- **RabbitMQ**: Ensure RabbitMQ is installed locally or accessible via Docker.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/nodesandbox/event-bus-sample.git
   cd event-bus-sample
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start RabbitMQ:
   If RabbitMQ is not running, start it locally or via Docker:
   ```bash
   docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:management
   ```

---

### Running the Services

Each service runs as a standalone Node.js server. Open a terminal for each service and start them:

1. **Order Service**:
   ```bash
   cd order-service
   npm start
   ```

2. **Inventory Service**:
   ```bash
   cd inventory-service
   npm start
   ```

3. **Payment Service**:
   ```bash
   cd payment-service
   npm start
   ```

4. **Notification Service**:
   ```bash
   cd notification-service
   npm start
   ```

---

### Testing the Flow

Use Postman, Curl, or any HTTP client to create an order and trigger the event flow.

#### **Creating an Order**

```bash
curl -X POST http://localhost:3001/orders \
-H "Content-Type: application/json" \
-d '{
    "userId": "user123",
    "items": [
        { "productId": "PROD1", "quantity": 2, "price": 19.99 },
        { "productId": "PROD2", "quantity": 1, "price": 9.99 }
    ]
}'
```

Expected behavior:
1. The **Order Service** publishes `order.created` and `stock.check` events.
2. The **Inventory Service** processes the `stock.check` event and publishes `stock.check.response`.
3. The **Order Service** reacts to the stock response and triggers a payment by publishing `payment.initiated`.
4. The **Payment Service** processes the payment and publishes either `payment.succeeded` or `payment.failed`.
5. The **Notification Service** sends notifications for key events.

---

### Monitoring with RabbitMQ Management UI

Access RabbitMQ's management interface at [http://localhost:15672/](http://localhost:15672/).  
Login credentials: `guest/guest`.

You can view:
- **Exchanges**: How events are routed.
- **Queues**: Message backlogs and processing status.
- **Dead Letter Queues (DLQs)**: Captured failed messages.

---

## Code Examples

### Order Service

The Order Service publishes events for order creation and stock checks.

```typescript
app.post('/orders', async (req, res) => {
  const orderId = uuid();
  const { userId, items } = req.body;

  const order = { orderId, userId, items, status: 'PENDING' };
  orders.set(orderId, order);

  const orderCreatedEvent = EventFactory.create('order.created', order);
  await eventBus.publish(orderCreatedEvent);

  const stockCheckEvent = EventFactory.create('stock.check', {
    orderId,
    items,
  });
  await eventBus.publish(stockCheckEvent);

  res.status(201).json({ orderId });
});
```

---

### Inventory Service

The Inventory Service listens for stock checks and updates stock availability.

```typescript
await eventBus.subscribe(['stock.check'], async (event) => {
  const { orderId, items } = event.data;

  const allAvailable = items.every((item) =>
    inventory.get(item.productId)?.stock >= item.quantity
  );

  if (allAvailable) {
    items.forEach((item) => {
      const product = inventory.get(item.productId);
      product.stock -= item.quantity;
    });

    const stockReservedEvent = EventFactory.create('stock.reserved', { orderId });
    await eventBus.publish(stockReservedEvent);
  } else {
    const stockCheckFailedEvent = EventFactory.create('stock.unavailable', { orderId });
    await eventBus.publish(stockCheckFailedEvent);
  }
});
```

---

## Contributing

We welcome contributions to improve this sample project or extend its functionality. To contribute:
1. Fork the repository.
2. Create a new branch.
3. Submit a pull request with your changes.

---

## License

This sample project is licensed under the MIT License. See [LICENSE](./LICENSE) for more details.