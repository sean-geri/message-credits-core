import { DomainError } from './domain.error';

export class InvalidPhoneError extends DomainError {
  constructor(public readonly phone: string) {
    super(`Phone ${phone} is invalid`);
  }
}
