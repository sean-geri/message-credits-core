import { DomainError } from './domain.error';

export class CampaignNotFoundError extends DomainError {
  constructor(public readonly campaignId: string) {
    super(`Campaign ${campaignId} not found`);
  }
}
