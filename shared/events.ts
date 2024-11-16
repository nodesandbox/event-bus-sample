export enum OrderEventType {
    ORDER_CREATED = 'order.created',
    ORDER_CONFIRMED = 'order.confirmed',
    ORDER_FAILED = 'order.failed',
    ORDER_COMPLETED = 'order.completed',
}

export enum StockEventType {
    STOCK_CHECK = 'stock.check',
    STOCK_CHECK_RESPONSE = 'stock.check.response',
    STOCK_RESERVED = 'stock.reserved',
    STOCK_RELEASED = 'stock.released',
}

export enum PaymentEventType {
    PAYMENT_INITIATED = 'payment.initiated',
    PAYMENT_SUCCEEDED = 'payment.succeeded',
    PAYMENT_FAILED = 'payment.failed',
}

export type EventType = OrderEventType | StockEventType | PaymentEventType;

  