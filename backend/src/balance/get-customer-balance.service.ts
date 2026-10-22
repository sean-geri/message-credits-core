import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  calculateCreditBreakdown,
  CreditBreakdown,
} from '../common/calculate-credit-breakdown';
import { CustomerNotFoundError } from '../common/errors/customer-not-found.error';
import { Campaign } from '../database/entities/campaign.entity';
import { CampaignStatus } from '../database/entities/campaign-status.enum';
import { Customer } from '../database/entities/customer.entity';
import { Order } from '../database/entities/order.entity';
import { OrderStatus } from '../database/entities/order-status.enum';
import { Recipient } from '../database/entities/recipient.entity';

export type AtRiskCampaign = {
  id: string;
  name: string;
  scheduledAt: Date;
  recipients: number;
  missingCredits: number;
};

export type CancelledOrderSummary = {
  id: string;
  credits: number;
  cancelledAt: Date | null;
};

export type CustomerBalance = CreditBreakdown & {
  shortfall: number;
  atRiskCampaigns: AtRiskCampaign[];
  cancelledOrders: CancelledOrderSummary[];
};

@Injectable()
export class GetCustomerBalanceService {
  constructor(private readonly dataSource: DataSource) {}

  async execute(customerId: string): Promise<CustomerBalance> {
    return this.dataSource.transaction(async (manager) => {
      const customer = await manager.findOne(Customer, {
        where: { id: customerId },
      });

      if (!customer) {
        throw new CustomerNotFoundError(customerId);
      }

      const breakdown = await calculateCreditBreakdown(manager, customerId);
      const scheduled = await manager.find(Campaign, {
        where: { customerId, status: CampaignStatus.Scheduled },
        order: { scheduledAt: 'ASC' },
      });
      const cancelled = await manager.find(Order, {
        where: { customerId, status: OrderStatus.Cancelled },
        order: { cancelledAt: 'DESC' },
      });

      return {
        ...breakdown,
        shortfall: Math.max(0, -breakdown.available),
        atRiskCampaigns: await this.atRiskCampaigns(
          manager,
          scheduled,
          breakdown,
        ),
        cancelledOrders: cancelled.map((order) => ({
          id: order.id,
          credits: order.credits,
          cancelledAt: order.cancelledAt,
        })),
      };
    });
  }

  private async atRiskCampaigns(
    manager: EntityManager,
    scheduled: Campaign[],
    breakdown: CreditBreakdown,
  ): Promise<AtRiskCampaign[]> {
    const atRisk: AtRiskCampaign[] = [];
    let remaining = breakdown.purchased - breakdown.spent - breakdown.inFlight;

    for (const campaign of scheduled) {
      const recipients = await manager.count(Recipient, {
        where: { campaignId: campaign.id },
      });

      if (remaining < recipients) {
        atRisk.push({
          id: campaign.id,
          name: campaign.name,
          scheduledAt: campaign.scheduledAt as Date,
          recipients,
          missingCredits: recipients - Math.max(remaining, 0),
        });
      }

      remaining -= recipients;
    }

    return atRisk;
  }
}
