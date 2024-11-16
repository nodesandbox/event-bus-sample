# EVENT_BUS Usage example

This example demonstrates how to use the `@digitaltg/event-bus` package to create a simple event bus.

## Prerequisites

- Node.js 14+
- Docker

## Usage

1. Start the rabbitmq service:

```bash
docker-compose up --build
```

2. Start the services:

```bash
npm run start
```

Note: The services will start in the background and will log their output to the console. You need to run the `npm run start` command in a separate terminal window to see the output of each service.