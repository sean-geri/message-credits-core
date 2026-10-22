import { DomainError } from './domain.error';

export class InsufficientCreditsError extends DomainError {
  constructor(
    public readonly needed: number,
    public readonly available: number,
  ) {
    super(`need ${needed}, available ${available}.`);
  }
}
