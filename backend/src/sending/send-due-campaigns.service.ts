import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Campaign } from '../database/entities/campaign.entity';
import { CampaignStatus } from '../database/entities/campaign-status.enum';
import { Message } from '../database/entities/message.entity';
import { MessageStatus } from '../database/entities/message-status.enum';
import { Recipient } from '../database/entities/recipient.entity';

@Injectable()
export class SendDueCampaignsService {
  constructor(private readonly dataSource: DataSource) {}

  async execute(now: Date): Promise<string[]> {
    const sentIds: string[] = [];

    for (;;) {
      const campaignId = await this.dataSource.transaction(async (manager) => {
        const campaign = await manager
          .getRepository(Campaign)
          .createQueryBuilder('campaign')
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .where('campaign.status = :status', {
            status: CampaignStatus.Scheduled,
          })
          .andWhere('campaign.scheduledAt <= :now', { now })
          .orderBy('campaign.scheduledAt', 'ASC')
          .limit(1)
          .getOne();

        if (!campaign) {
          return null;
        }

        const recipients = await manager.find(Recipient, {
          where: { campaignId: campaign.id },
        });

        if (recipients.length > 0) {
          await manager
            .createQueryBuilder()
            .insert()
            .into(Message)
            .values(
              recipients.map((recipient) => ({
                campaignId: campaign.id,
                recipientId: recipient.id,
                status: MessageStatus.Pending,
              })),
            )
            .orIgnore()
            .execute();
        }

        campaign.status = CampaignStatus.Sent;
        campaign.sentAt = now;
        await manager.save(campaign);

        return campaign.id;
      });

      if (!campaignId) {
        break;
      }

      sentIds.push(campaignId);
    }

    return sentIds;
  }
}
