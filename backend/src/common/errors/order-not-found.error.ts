import { DomainError } from './domain.error';

export class OrderNotFoundError extends DomainError {
  constructor(public readonly orderId: string) {
    super(`Order ${orderId} not found`);
  }
}
