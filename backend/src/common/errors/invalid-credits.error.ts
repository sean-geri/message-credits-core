import { DomainError } from './domain.error';

export class InvalidCreditsError extends DomainError {
  readonly code = 'INVALID_CREDITS';

  constructor(public readonly credits: number) {
    super(`Credits ${credits} must be a positive integer`);
  }
}
