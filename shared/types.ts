export interface OrderItem {
    productId: string;
    quantity: number;
    price: number;
  }
  
  export interface OrderData {
    orderId: string;
    userId: string;
    items: OrderItem[];
    totalAmount: number;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
  }
  
  export interface PaymentData {
    orderId: string;
    amount: number;
    paymentId: string;
  }
  
  export interface StockData {
    orderId: string;
    items: Array<{
      productId: string;
      quantity: number;
    }>;
  }
  
  export interface StockCheckResponse {
    orderId: string;
    available: boolean;
    items: Array<{
      productId: string;
      available: boolean;
      currentStock: number;
    }>;
  }