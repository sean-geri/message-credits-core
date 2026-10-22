import { DomainError } from './domain.error';

export class CampaignHasNoRecipientsError extends DomainError {
  readonly code = 'CAMPAIGN_HAS_NO_RECIPIENTS';

  constructor(public readonly campaignId: string) {
    super(`Campaign ${campaignId} has no recipients`);
  }
}
