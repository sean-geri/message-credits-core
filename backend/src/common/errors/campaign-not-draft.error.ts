import { DomainError } from './domain.error';

export class CampaignNotDraftError extends DomainError {
  readonly code = 'CAMPAIGN_NOT_DRAFT';

  constructor(public readonly campaignId: string) {
    super(`Campaign ${campaignId} is not draft`);
  }
}
