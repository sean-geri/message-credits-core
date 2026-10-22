import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { CampaignNotFoundError } from '../common/errors/campaign-not-found.error';
import { SentCampaignRecipientsError } from '../common/errors/sent-campaign-recipients.error';
import { lockCustomer } from '../common/lock-customer';
import { Campaign } from '../database/entities/campaign.entity';
import { CampaignStatus } from '../database/entities/campaign-status.enum';
import { Recipient } from '../database/entities/recipient.entity';

@Injectable()
export class RemoveRecipientsService {
  constructor(private readonly dataSource: DataSource) {}

  async execute(campaignId: string, phones: string[]): Promise<number> {
    if (phones.length === 0) {
      return 0;
    }

    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(Campaign, {
        where: { id: campaignId },
      });

      if (!existing) {
        throw new CampaignNotFoundError(campaignId);
      }

      await lockCustomer(manager, existing.customerId);

      const campaign = await manager.findOne(Campaign, {
        where: { id: campaignId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!campaign) {
        throw new CampaignNotFoundError(campaignId);
      }

      if (campaign.status === CampaignStatus.Sent) {
        throw new SentCampaignRecipientsError();
      }

      const result = await manager.delete(Recipient, {
        campaignId,
        phone: In(phones),
      });

      return result.affected ?? 0;
    });
  }
}
