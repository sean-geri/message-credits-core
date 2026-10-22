import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CampaignNotFoundError } from '../common/errors/campaign-not-found.error';
import { CampaignNotScheduledError } from '../common/errors/campaign-not-scheduled.error';
import { lockCustomer } from '../common/lock-customer';
import { Campaign } from '../database/entities/campaign.entity';
import { CampaignStatus } from '../database/entities/campaign-status.enum';

@Injectable()
export class CancelScheduleService {
  constructor(private readonly dataSource: DataSource) {}

  async cancelSchedule(campaignId: string): Promise<Campaign> {
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

      if (campaign.status !== CampaignStatus.Scheduled) {
        throw new CampaignNotScheduledError(campaignId);
      }

      campaign.status = CampaignStatus.Draft;
      campaign.scheduledAt = null;

      return manager.save(campaign);
    });
  }
}
