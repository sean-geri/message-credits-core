import { DomainError } from './domain.error';

export class EmptyCampaignFieldError extends DomainError {
  constructor(public readonly field: 'name' | 'body') {
    super(`Campaign ${field} must not be empty`);
  }
}
