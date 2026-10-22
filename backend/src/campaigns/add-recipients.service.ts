import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { calculateAvailableCredit } from '../common/calculate-available-credit';
import { CampaignNotAcceptingRecipientsError } from '../common/errors/campaign-not-accepting-recipients.error';
import { CampaignNotFoundError } from '../common/errors/campaign-not-found.error';
import { InsufficientCreditsError } from '../common/errors/insufficient-credits.error';
import { InvalidPhoneError } from '../common/errors/invalid-phone.error';
import { lockCustomer } from '../common/lock-customer';
import { Campaign } from '../database/entities/campaign.entity';
import { CampaignStatus } from '../database/entities/campaign-status.enum';
import { Recipient } from '../database/entities/recipient.entity';

const E164_PHONE = /^\+?\d{8,15}$/;

@Injectable()
export class AddRecipientsService {
  constructor(private readonly dataSource: DataSource) {}

  async execute(campaignId: string, phones: string[]): Promise<number> {
    const uniquePhones = uniqueValidPhones(phones);

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

      if (
        campaign.status === CampaignStatus.Sent ||
        campaign.status === CampaignStatus.Cancelled
      ) {
        throw new CampaignNotAcceptingRecipientsError(campaign.status);
      }

      const toAdd = await phonesNotOnCampaign(
        manager,
        campaignId,
        uniquePhones,
      );

      if (campaign.status === CampaignStatus.Scheduled) {
        const available = await calculateAvailableCredit(
          manager,
          campaign.customerId,
        );

        if (toAdd.length > available) {
          throw new InsufficientCreditsError(toAdd.length, available);
        }
      }

      if (toAdd.length === 0) {
        return 0;
      }

      await manager.insert(
        Recipient,
        toAdd.map((phone) => ({ campaignId, phone })),
      );

      return toAdd.length;
    });
  }
}

function uniqueValidPhones(phones: string[]): string[] {
  const trimmed = phones.map((phone) => phone.trim());

  for (const phone of trimmed) {
    if (!E164_PHONE.test(phone)) {
      throw new InvalidPhoneError(phone);
    }
  }

  return [...new Set(trimmed)];
}

async function phonesNotOnCampaign(
  manager: EntityManager,
  campaignId: string,
  phones: string[],
): Promise<string[]> {
  if (phones.length === 0) {
    return [];
  }

  const existing = await manager.find(Recipient, {
    where: { campaignId, phone: In(phones) },
  });
  const already = new Set(existing.map((recipient) => recipient.phone));

  return phones.filter((phone) => !already.has(phone));
}
