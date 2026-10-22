import { DomainError } from './domain.error';

export class CustomerNotFoundError extends DomainError {
  constructor(public readonly customerId: string) {
    super(`Customer ${customerId} not found`);
  }
}
