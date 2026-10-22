import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { calculateAvailableCredit } from '../common/calculate-available-credit';
import { MessageNotFoundError } from '../common/errors/message-not-found.error';
import { lockCustomer } from '../common/lock-customer';
import { Campaign } from '../database/entities/campaign.entity';
import { CampaignStatus } from '../database/entities/campaign-status.enum';
import { Customer } from '../database/entities/customer.entity';
import { DispatchResult } from '../database/entities/dispatch-result.entity';
import { Message } from '../database/entities/message.entity';
import { MessageStatus } from '../database/entities/message-status.enum';
import { Order } from '../database/entities/order.entity';
import { OrderStatus } from '../database/entities/order-status.enum';
import { Recipient } from '../database/entities/recipient.entity';
import { createCustomer } from '../../test/utils/create-customer';
import { resetDb } from '../../test/utils/reset-db';
import { RecordDispatchResultService } from './record-dispatch-result.service';
import { SendDueCampaignsService } from './send-due-campaigns.service';
import { SendingModule } from './sending.module';

describe('Sending services', () => {
  let module: TestingModule;
  let sendDueCampaigns: SendDueCampaignsService;
  let recordDispatchResult: RecordDispatchResultService;
  let dataSource: DataSource;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT),
          username: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          entities: [
            Customer,
            Order,
            Campaign,
            Recipient,
            Message,
            DispatchResult,
          ],
          synchronize: false,
        }),
        SendingModule,
      ],
    }).compile();

    sendDueCampaigns = module.get(SendDueCampaignsService);
    recordDispatchResult = module.get(RecordDispatchResultService);
    dataSource = module.get(DataSource);
  });

  beforeEach(async () => {
    await resetDb(dataSource);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('SendDueCampaignsService', () => {
    it('sends due campaigns oldest first and does not send them again', async () => {
      const customer = await createCustomer(dataSource);
      const now = new Date('2026-04-01T00:00:00.000Z');
      const older = await saveScheduledCampaign(
        dataSource,
        customer.id,
        new Date('2026-03-01T00:00:00.000Z'),
        ['+15551230001', '+15551230002'],
      );
      const newer = await saveScheduledCampaign(
        dataSource,
        customer.id,
        new Date('2026-03-15T00:00:00.000Z'),
        ['+15551230003'],
      );
      const future = await saveScheduledCampaign(
        dataSource,
        customer.id,
        new Date('2026-05-01T00:00:00.000Z'),
        ['+15551230004'],
      );

      const sentIds = await sendDueCampaigns.execute(now);

      expect(sentIds).toEqual([older.id, newer.id]);
      const olderStored = await dataSource
        .getRepository(Campaign)
        .findOneByOrFail({ id: older.id });
      const newerStored = await dataSource
        .getRepository(Campaign)
        .findOneByOrFail({ id: newer.id });
      const futureStored = await dataSource
        .getRepository(Campaign)
        .findOneByOrFail({ id: future.id });

      expect(olderStored.status).toBe(CampaignStatus.Sent);
      expect(olderStored.sentAt).toEqual(now);
      expect(newerStored.status).toBe(CampaignStatus.Sent);
      expect(newerStored.sentAt).toEqual(now);
      expect(futureStored.status).toBe(CampaignStatus.Scheduled);
      await expect(messageStatuses(dataSource, older.id)).resolves.toEqual([
        MessageStatus.Pending,
        MessageStatus.Pending,
      ]);
      await expect(messageStatuses(dataSource, newer.id)).resolves.toEqual([
        MessageStatus.Pending,
      ]);
      await expect(messageStatuses(dataSource, future.id)).resolves.toEqual([]);

      await expect(sendDueCampaigns.execute(now)).resolves.toEqual([]);
    });

    it('sends each due campaign once when two executes run together', async () => {
      const customer = await createCustomer(dataSource);
      const now = new Date('2026-04-01T00:00:00.000Z');
      const older = await saveScheduledCampaign(
        dataSource,
        customer.id,
        new Date('2026-03-01T00:00:00.000Z'),
        ['+15551230001', '+15551230002'],
      );
      const newer = await saveScheduledCampaign(
        dataSource,
        customer.id,
        new Date('2026-03-15T00:00:00.000Z'),
        ['+15551230003'],
      );

      const [first, second] = await Promise.all([
        sendDueCampaigns.execute(now),
        sendDueCampaigns.execute(now),
      ]);
      const sentIds = [...first, ...second].sort();

      expect(sentIds).toEqual([older.id, newer.id].sort());
      expect(new Set(sentIds).size).toBe(2);
      await expect(messageStatuses(dataSource, older.id)).resolves.toEqual([
        MessageStatus.Pending,
        MessageStatus.Pending,
      ]);
      await expect(messageStatuses(dataSource, newer.id)).resolves.toEqual([
        MessageStatus.Pending,
      ]);
    });

    it('ignores draft, cancelled, and not-yet-due campaigns', async () => {
      const customer = await createCustomer(dataSource);
      const now = new Date('2026-04-01T00:00:00.000Z');
      const past = new Date('2026-03-01T00:00:00.000Z');
      const due = await saveScheduledCampaign(dataSource, customer.id, past, [
        '+15551230001',
      ]);
      const draft = await saveCampaignWithRecipients(
        dataSource,
        customer.id,
        CampaignStatus.Draft,
        past,
        ['+15551230002'],
      );
      const cancelled = await saveCampaignWithRecipients(
        dataSource,
        customer.id,
        CampaignStatus.Cancelled,
        past,
        ['+15551230003'],
      );
      const future = await saveScheduledCampaign(
        dataSource,
        customer.id,
        new Date('2026-05-01T00:00:00.000Z'),
        ['+15551230004'],
      );

      await expect(sendDueCampaigns.execute(now)).resolves.toEqual([due.id]);

      const stored = await dataSource.getRepository(Campaign).find({
        where: [{ id: draft.id }, { id: cancelled.id }, { id: future.id }],
      });
      const statusById = new Map(
        stored.map((campaign) => [campaign.id, campaign.status]),
      );
      expect(statusById.get(draft.id)).toBe(CampaignStatus.Draft);
      expect(statusById.get(cancelled.id)).toBe(CampaignStatus.Cancelled);
      expect(statusById.get(future.id)).toBe(CampaignStatus.Scheduled);
      await expect(messageStatuses(dataSource, draft.id)).resolves.toEqual([]);
      await expect(messageStatuses(dataSource, cancelled.id)).resolves.toEqual(
        [],
      );
      await expect(messageStatuses(dataSource, future.id)).resolves.toEqual([]);
    });

    it('sends when available credit is negative after an order was cancelled', async () => {
      const customer = await createCustomer(dataSource);
      const now = new Date('2026-04-01T00:00:00.000Z');
      const order = await dataSource.getRepository(Order).save({
        customerId: customer.id,
        credits: 2,
        status: OrderStatus.Active,
      });
      const campaign = await saveScheduledCampaign(
        dataSource,
        customer.id,
        new Date('2026-03-01T00:00:00.000Z'),
        ['+15551230001', '+15551230002'],
      );

      await dataSource.getRepository(Order).update(order.id, {
        status: OrderStatus.Cancelled,
        cancelledAt: new Date('2026-03-20T00:00:00.000Z'),
      });

      expect(await availableCredit(dataSource, customer.id)).toBe(-2);

      await expect(sendDueCampaigns.execute(now)).resolves.toEqual([
        campaign.id,
      ]);
      const stored = await dataSource
        .getRepository(Campaign)
        .findOneByOrFail({ id: campaign.id });
      expect(stored.status).toBe(CampaignStatus.Sent);
      expect(stored.sentAt).toEqual(now);
      await expect(messageStatuses(dataSource, campaign.id)).resolves.toEqual([
        MessageStatus.Pending,
        MessageStatus.Pending,
      ]);
    });
  });

  describe('RecordDispatchResultService', () => {
    const reportedAt = new Date('2026-04-02T00:00:00.000Z');
    const laterReport = new Date('2026-04-03T00:00:00.000Z');

    it('counts a pending message that becomes accepted as spent', async () => {
      const customer = await createCustomer(dataSource);
      await saveOrder(dataSource, customer.id, 1);
      const message = await savePendingMessage(dataSource, customer.id);

      const result = await recordDispatchResult.execute(
        message.id,
        'accepted',
        reportedAt,
      );

      expect(result.changed).toBe(true);
      expect(result.message.status).toBe(MessageStatus.Accepted);
      expect(result.message.resolvedAt).toEqual(reportedAt);
      expect(await availableCredit(dataSource, customer.id)).toBe(0);
    });

    it('returns credit when a pending message is rejected', async () => {
      const customer = await createCustomer(dataSource);
      await saveOrder(dataSource, customer.id, 1);
      const message = await savePendingMessage(dataSource, customer.id);

      const result = await recordDispatchResult.execute(
        message.id,
        'rejected',
        reportedAt,
      );

      expect(result.changed).toBe(true);
      expect(result.message.status).toBe(MessageStatus.Rejected);
      expect(await availableCredit(dataSource, customer.id)).toBe(1);
    });

    it('does not double charge a duplicate accepted report', async () => {
      const customer = await createCustomer(dataSource);
      await saveOrder(dataSource, customer.id, 1);
      const message = await savePendingMessage(dataSource, customer.id);

      await recordDispatchResult.execute(message.id, 'accepted', reportedAt);
      const duplicate = await recordDispatchResult.execute(
        message.id,
        'accepted',
        laterReport,
      );

      expect(duplicate.changed).toBe(false);
      expect(duplicate.message.status).toBe(MessageStatus.Accepted);
      expect(duplicate.message.resolvedAt).toEqual(reportedAt);
      expect(await availableCredit(dataSource, customer.id)).toBe(0);
      await expect(
        dataSource.getRepository(DispatchResult).count({
          where: { messageId: message.id },
        }),
      ).resolves.toBe(2);
    });

    it('lets a late acceptance win after rejection and spends the credit again', async () => {
      const customer = await createCustomer(dataSource);
      await saveOrder(dataSource, customer.id, 1);
      const message = await savePendingMessage(dataSource, customer.id);

      await recordDispatchResult.execute(message.id, 'rejected', reportedAt);
      expect(await availableCredit(dataSource, customer.id)).toBe(1);

      const accepted = await recordDispatchResult.execute(
        message.id,
        'accepted',
        laterReport,
      );

      expect(accepted.changed).toBe(true);
      expect(accepted.message.status).toBe(MessageStatus.Accepted);
      expect(accepted.message.resolvedAt).toEqual(laterReport);
      expect(await availableCredit(dataSource, customer.id)).toBe(0);
    });

    it('keeps an accepted message accepted when a rejection arrives later', async () => {
      const customer = await createCustomer(dataSource);
      await saveOrder(dataSource, customer.id, 1);
      const message = await savePendingMessage(dataSource, customer.id);

      await recordDispatchResult.execute(message.id, 'accepted', reportedAt);
      const rejected = await recordDispatchResult.execute(
        message.id,
        'rejected',
        laterReport,
      );

      expect(rejected.changed).toBe(false);
      expect(rejected.message.status).toBe(MessageStatus.Accepted);
      expect(rejected.message.resolvedAt).toEqual(reportedAt);
      expect(await availableCredit(dataSource, customer.id)).toBe(0);
    });

    it('changes a message once when two identical reports run together', async () => {
      const customer = await createCustomer(dataSource);
      await saveOrder(dataSource, customer.id, 1);
      const message = await savePendingMessage(dataSource, customer.id);

      const results = await Promise.all([
        recordDispatchResult.execute(message.id, 'accepted', reportedAt),
        recordDispatchResult.execute(message.id, 'accepted', reportedAt),
      ]);

      expect(results.filter((result) => result.changed)).toHaveLength(1);
      expect(results.every((result) => result.message.status === 'accepted'));
      const stored = await dataSource.getRepository(Message).findOneByOrFail({
        id: message.id,
      });
      expect(stored.status).toBe(MessageStatus.Accepted);
      expect(await availableCredit(dataSource, customer.id)).toBe(0);
    });

    it('throws MessageNotFoundError for an unknown message', async () => {
      await expect(
        recordDispatchResult.execute(randomUUID(), 'accepted', reportedAt),
      ).rejects.toBeInstanceOf(MessageNotFoundError);
    });
  });
});

async function saveScheduledCampaign(
  dataSource: DataSource,
  customerId: string,
  scheduledAt: Date,
  phones: string[],
): Promise<Campaign> {
  const campaign = await dataSource.getRepository(Campaign).save({
    customerId,
    name: 'Launch',
    body: 'Hello',
    status: CampaignStatus.Scheduled,
    scheduledAt,
  });

  for (const phone of phones) {
    await dataSource.getRepository(Recipient).save({
      campaignId: campaign.id,
      phone,
    });
  }

  return campaign;
}

async function saveCampaignWithRecipients(
  dataSource: DataSource,
  customerId: string,
  status: CampaignStatus,
  scheduledAt: Date,
  phones: string[],
): Promise<Campaign> {
  const campaign = await dataSource.getRepository(Campaign).save({
    customerId,
    name: 'Launch',
    body: 'Hello',
    status,
    scheduledAt,
  });

  for (const phone of phones) {
    await dataSource.getRepository(Recipient).save({
      campaignId: campaign.id,
      phone,
    });
  }

  return campaign;
}

async function savePendingMessage(
  dataSource: DataSource,
  customerId: string,
): Promise<Message> {
  const campaign = await dataSource.getRepository(Campaign).save({
    customerId,
    name: 'Launch',
    body: 'Hello',
    status: CampaignStatus.Sent,
    sentAt: new Date('2026-03-01T00:00:00.000Z'),
  });
  const recipient = await dataSource.getRepository(Recipient).save({
    campaignId: campaign.id,
    phone: '+15551230001',
  });

  return dataSource.getRepository(Message).save({
    campaignId: campaign.id,
    recipientId: recipient.id,
    status: MessageStatus.Pending,
  });
}

async function saveOrder(
  dataSource: DataSource,
  customerId: string,
  credits: number,
): Promise<void> {
  await dataSource.getRepository(Order).save({
    customerId,
    credits,
    status: OrderStatus.Active,
  });
}

function messageStatuses(
  dataSource: DataSource,
  campaignId: string,
): Promise<MessageStatus[]> {
  return dataSource
    .getRepository(Message)
    .find({ where: { campaignId } })
    .then((messages) => messages.map((message) => message.status));
}

function availableCredit(
  dataSource: DataSource,
  customerId: string,
): Promise<number> {
  return dataSource.transaction(async (manager) => {
    await lockCustomer(manager, customerId);
    return calculateAvailableCredit(manager, customerId);
  });
}
