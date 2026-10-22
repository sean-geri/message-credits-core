import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { calculateAvailableCredit } from '../common/calculate-available-credit';
import { CampaignHasNoRecipientsError } from '../common/errors/campaign-has-no-recipients.error';
import { CampaignNotDraftError } from '../common/errors/campaign-not-draft.error';
import { CampaignNotFoundError } from '../common/errors/campaign-not-found.error';
import { InsufficientCreditsError } from '../common/errors/insufficient-credits.error';
import { ScheduleTimeInPastError } from '../common/errors/schedule-time-in-past.error';
import { lockCustomer } from '../common/lock-customer';
import { Campaign } from '../database/entities/campaign.entity';
import { CampaignStatus } from '../database/entities/campaign-status.enum';
import { Recipient } from '../database/entities/recipient.entity';

@Injectable()
export class ScheduleCampaignService {
  constructor(private readonly dataSource: DataSource) {}

  async execute(
    campaignId: string,
    sendAt: Date,
    now: Date,
  ): Promise<Campaign> {
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

      if (campaign.status !== CampaignStatus.Draft) {
        throw new CampaignNotDraftError(campaignId);
      }

      if (sendAt.getTime() <= now.getTime()) {
        throw new ScheduleTimeInPastError();
      }

      const recipientCount = await manager.count(Recipient, {
        where: { campaignId },
      });

      if (recipientCount < 1) {
        throw new CampaignHasNoRecipientsError(campaignId);
      }

      const available = await calculateAvailableCredit(
        manager,
        campaign.customerId,
      );

      if (recipientCount > available) {
        throw new InsufficientCreditsError(recipientCount, available);
      }

      campaign.status = CampaignStatus.Scheduled;
      campaign.scheduledAt = sendAt;

      return manager.save(campaign);
    });
  }
}
