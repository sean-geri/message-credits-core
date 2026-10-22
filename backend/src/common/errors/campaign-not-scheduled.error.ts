import { DomainError } from './domain.error';

export class CampaignNotScheduledError extends DomainError {
  readonly code = 'CAMPAIGN_NOT_SCHEDULED';

  constructor(public readonly campaignId: string) {
    super(`Campaign ${campaignId} is not scheduled`);
  }
}
