import { DomainError } from './domain.error';

export class MessageNotFoundError extends DomainError {
  constructor(public readonly messageId: string) {
    super(`Message ${messageId} not found`);
  }
}
