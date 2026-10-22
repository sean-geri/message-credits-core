import { DomainError } from './domain.error';

export class SentCampaignRecipientsError extends DomainError {
  constructor() {
    super('Cannot remove recipients from a sent campaign');
  }
}
