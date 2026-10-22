import { DomainError } from './domain.error';

export class OrderAlreadyCancelledError extends DomainError {
  constructor(public readonly orderId: string) {
    super(`Order ${orderId} already cancelled`);
  }
}
