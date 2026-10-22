import { DomainError } from './domain.error';
import { CampaignStatus } from '../../database/entities/campaign-status.enum';

export class CampaignNotAcceptingRecipientsError extends DomainError {
  constructor(public readonly status: CampaignStatus) {
    super(`Cannot add recipients to a ${status} campaign`);
  }
}
