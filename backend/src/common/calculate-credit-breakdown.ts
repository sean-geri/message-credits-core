import { EntityManager } from 'typeorm';
import { CampaignStatus } from '../database/entities/campaign-status.enum';
import { Message } from '../database/entities/message.entity';
import { MessageStatus } from '../database/entities/message-status.enum';
import { Order } from '../database/entities/order.entity';
import { OrderStatus } from '../database/entities/order-status.enum';
import { Recipient } from '../database/entities/recipient.entity';

export type CreditBreakdown = {
  purchased: number;
  reserved: number;
  inFlight: number;
  spent: number;
  available: number;
};

export async function calculateCreditBreakdown(
  em: EntityManager,
  customerId: string,
): Promise<CreditBreakdown> {
  const purchasedRow = await em
    .createQueryBuilder(Order, 'activeOrder')
    .select('COALESCE(SUM(activeOrder.credits), 0)', 'purchased')
    .where('activeOrder.customerId = :customerId', { customerId })
    .andWhere('activeOrder.status = :status', { status: OrderStatus.Active })
    .getRawOne<{ purchased: string | number }>();
  const purchased = Number(purchasedRow?.purchased ?? 0);

  const reserved = await em
    .createQueryBuilder(Recipient, 'recipient')
    .innerJoin('recipient.campaign', 'campaign')
    .where('campaign.customerId = :customerId', { customerId })
    .andWhere('campaign.status = :status', { status: CampaignStatus.Scheduled })
    .getCount();

  const inFlight = await em
    .createQueryBuilder(Message, 'message')
    .innerJoin('message.campaign', 'campaign')
    .where('campaign.customerId = :customerId', { customerId })
    .andWhere('message.status = :status', { status: MessageStatus.Pending })
    .getCount();

  const spent = await em
    .createQueryBuilder(Message, 'message')
    .innerJoin('message.campaign', 'campaign')
    .where('campaign.customerId = :customerId', { customerId })
    .andWhere('message.status = :status', { status: MessageStatus.Accepted })
    .getCount();

  return {
    purchased,
    reserved,
    inFlight,
    spent,
    available: purchased - reserved - inFlight - spent,
  };
}
