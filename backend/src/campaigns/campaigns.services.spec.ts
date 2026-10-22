import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CustomerNotFoundError } from '../common/errors/customer-not-found.error';
import { CampaignNotAcceptingRecipientsError } from '../common/errors/campaign-not-accepting-recipients.error';
import { CampaignNotFoundError } from '../common/errors/campaign-not-found.error';
import { EmptyCampaignFieldError } from '../common/errors/empty-campaign-field.error';
import { InsufficientCreditsError } from '../common/errors/insufficient-credits.error';
import { InvalidPhoneError } from '../common/errors/invalid-phone.error';
import { SentCampaignRecipientsError } from '../common/errors/sent-campaign-recipients.error';
import { Campaign } from '../database/entities/campaign.entity';
import { CampaignStatus } from '../database/entities/campaign-status.enum';
import { Customer } from '../database/entities/customer.entity';
import { DispatchResult } from '../database/entities/dispatch-result.entity';
import { Message } from '../database/entities/message.entity';
import { Order } from '../database/entities/order.entity';
import { OrderStatus } from '../database/entities/order-status.enum';
import { Recipient } from '../database/entities/recipient.entity';
import { createCustomer } from '../../test/utils/create-customer';
import { resetDb } from '../../test/utils/reset-db';
import { AddRecipientsService } from './add-recipients.service';
import { CampaignsModule } from './campaigns.module';
import { CreateCampaignService } from './create-campaign.service';
import { RemoveRecipientsService } from './remove-recipients.service';

describe('Campaign services', () => {
  let module: TestingModule;
  let createCampaign: CreateCampaignService;
  let addRecipients: AddRecipientsService;
  let removeRecipients: RemoveRecipientsService;
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
        CampaignsModule,
      ],
    }).compile();

    createCampaign = module.get(CreateCampaignService);
    addRecipients = module.get(AddRecipientsService);
    removeRecipients = module.get(RemoveRecipientsService);
    dataSource = module.get(DataSource);
  });

  beforeEach(async () => {
    await resetDb(dataSource);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('CreateCampaignService', () => {
    it('stores a draft campaign with trimmed name and body', async () => {
      const customer = await createCustomer(dataSource);

      const campaign = await createCampaign.execute(
        customer.id,
        '  Launch  ',
        '  Hello  ',
      );
      const stored = await dataSource.getRepository(Campaign).findOneByOrFail({
        id: campaign.id,
      });

      expect(stored.customerId).toBe(customer.id);
      expect(stored.name).toBe('Launch');
      expect(stored.body).toBe('Hello');
      expect(stored.status).toBe(CampaignStatus.Draft);
    });

    it('throws CustomerNotFoundError for an unknown customer', async () => {
      await expect(
        createCampaign.execute(randomUUID(), 'Launch', 'Hello'),
      ).rejects.toBeInstanceOf(CustomerNotFoundError);
    });

    it.each(['name', 'body'] as const)('rejects a blank %s', async (field) => {
      const customer = await createCustomer(dataSource);
      const name = field === 'name' ? '   ' : 'Launch';
      const body = field === 'body' ? '   ' : 'Hello';

      await expect(
        createCampaign.execute(customer.id, name, body),
      ).rejects.toBeInstanceOf(EmptyCampaignFieldError);
      await expect(dataSource.getRepository(Campaign).count()).resolves.toBe(0);
    });
  });

  describe('AddRecipientsService', () => {
    it('adds new phones on a draft and skips duplicates without credit', async () => {
      const customer = await createCustomer(dataSource);
      const campaign = await saveCampaign(dataSource, customer.id, {
        status: CampaignStatus.Draft,
      });
      await saveRecipient(dataSource, campaign.id, '+15551230001');

      const added = await addRecipients.execute(campaign.id, [
        '+15551230001',
        ' +15551230001 ',
        '+15551230002',
      ]);

      expect(added).toBe(1);
      await expect(phonesFor(dataSource, campaign.id)).resolves.toEqual([
        '+15551230001',
        '+15551230002',
      ]);
    });

    it('refuses a scheduled batch that needs more credit than is available', async () => {
      const customer = await createCustomer(dataSource);
      await saveOrder(dataSource, customer.id, 1);
      const campaign = await saveCampaign(dataSource, customer.id, {
        status: CampaignStatus.Scheduled,
        scheduledAt: new Date('2026-02-01T00:00:00.000Z'),
      });

      await expect(
        addRecipients.execute(campaign.id, ['+15551230001', '+15551230002']),
      ).rejects.toThrow('need 2, available 1.');
      await expect(
        addRecipients.execute(campaign.id, ['+15551230001', '+15551230002']),
      ).rejects.toBeInstanceOf(InsufficientCreditsError);
      await expect(phonesFor(dataSource, campaign.id)).resolves.toEqual([]);
    });

    it('adds scheduled recipients when credit covers the new phones', async () => {
      const customer = await createCustomer(dataSource);
      await saveOrder(dataSource, customer.id, 2);
      const campaign = await saveCampaign(dataSource, customer.id, {
        status: CampaignStatus.Scheduled,
        scheduledAt: new Date('2026-02-01T00:00:00.000Z'),
      });

      const added = await addRecipients.execute(campaign.id, [
        '+15551230001',
        '+15551230002',
      ]);

      expect(added).toBe(2);
    });

    it('does not charge again for a recipient already on the campaign', async () => {
      const customer = await createCustomer(dataSource);
      await saveOrder(dataSource, customer.id, 1);
      const campaign = await saveCampaign(dataSource, customer.id, {
        status: CampaignStatus.Scheduled,
        scheduledAt: new Date('2026-02-01T00:00:00.000Z'),
      });
      await saveRecipient(dataSource, campaign.id, '+15551230001');

      const added = await addRecipients.execute(campaign.id, [
        '+15551230001',
        '+15551230001',
      ]);

      expect(added).toBe(0);
      await expect(phonesFor(dataSource, campaign.id)).resolves.toEqual([
        '+15551230001',
      ]);
    });

    it.each([CampaignStatus.Sent, CampaignStatus.Cancelled])(
      'refuses to add recipients to a %s campaign',
      async (status) => {
        const customer = await createCustomer(dataSource);
        const campaign = await saveCampaign(dataSource, customer.id, {
          status,
          scheduledAt:
            status === CampaignStatus.Sent
              ? new Date('2026-02-01T00:00:00.000Z')
              : null,
          sentAt:
            status === CampaignStatus.Sent
              ? new Date('2026-02-02T00:00:00.000Z')
              : null,
        });

        await expect(
          addRecipients.execute(campaign.id, ['+15551230001']),
        ).rejects.toBeInstanceOf(CampaignNotAcceptingRecipientsError);
        await expect(phonesFor(dataSource, campaign.id)).resolves.toEqual([]);
      },
    );

    it('refuses an invalid phone and inserts nothing', async () => {
      const customer = await createCustomer(dataSource);
      const campaign = await saveCampaign(dataSource, customer.id, {
        status: CampaignStatus.Draft,
      });

      await expect(
        addRecipients.execute(campaign.id, ['+15551230001', '123']),
      ).rejects.toBeInstanceOf(InvalidPhoneError);
      await expect(phonesFor(dataSource, campaign.id)).resolves.toEqual([]);
    });

    it('throws CampaignNotFoundError for an unknown campaign', async () => {
      await expect(
        addRecipients.execute(randomUUID(), ['+15551230001']),
      ).rejects.toBeInstanceOf(CampaignNotFoundError);
    });
  });

  describe('RemoveRecipientsService', () => {
    it.each([
      CampaignStatus.Draft,
      CampaignStatus.Scheduled,
      CampaignStatus.Cancelled,
    ])('removes recipients from a %s campaign', async (status) => {
      const customer = await createCustomer(dataSource);
      const campaign = await saveCampaign(dataSource, customer.id, {
        status,
        scheduledAt:
          status === CampaignStatus.Scheduled
            ? new Date('2026-02-01T00:00:00.000Z')
            : null,
      });
      await saveRecipient(dataSource, campaign.id, '+15551230001');
      await saveRecipient(dataSource, campaign.id, '+15551230002');

      const removed = await removeRecipients.execute(campaign.id, [
        '+15551230001',
      ]);

      expect(removed).toBe(1);
      await expect(phonesFor(dataSource, campaign.id)).resolves.toEqual([
        '+15551230002',
      ]);
    });

    it('refuses to remove recipients from a sent campaign', async () => {
      const customer = await createCustomer(dataSource);
      const campaign = await saveCampaign(dataSource, customer.id, {
        status: CampaignStatus.Sent,
        scheduledAt: new Date('2026-02-01T00:00:00.000Z'),
        sentAt: new Date('2026-02-02T00:00:00.000Z'),
      });
      await saveRecipient(dataSource, campaign.id, '+15551230001');

      await expect(
        removeRecipients.execute(campaign.id, ['+15551230001']),
      ).rejects.toBeInstanceOf(SentCampaignRecipientsError);
      await expect(phonesFor(dataSource, campaign.id)).resolves.toEqual([
        '+15551230001',
      ]);
    });

    it('returns 0 for an empty phone list', async () => {
      const customer = await createCustomer(dataSource);
      const campaign = await saveCampaign(dataSource, customer.id, {
        status: CampaignStatus.Draft,
      });

      await expect(removeRecipients.execute(campaign.id, [])).resolves.toBe(0);
    });
  });
});

async function saveCampaign(
  dataSource: DataSource,
  customerId: string,
  values: {
    status: CampaignStatus;
    scheduledAt?: Date | null;
    sentAt?: Date | null;
  },
): Promise<Campaign> {
  return dataSource.getRepository(Campaign).save({
    customerId,
    name: 'Launch',
    body: 'Hello',
    status: values.status,
    scheduledAt: values.scheduledAt ?? null,
    sentAt: values.sentAt ?? null,
  });
}

async function saveRecipient(
  dataSource: DataSource,
  campaignId: string,
  phone: string,
): Promise<void> {
  await dataSource.getRepository(Recipient).save({ campaignId, phone });
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

function phonesFor(
  dataSource: DataSource,
  campaignId: string,
): Promise<string[]> {
  return dataSource
    .getRepository(Recipient)
    .find({ where: { campaignId }, order: { phone: 'ASC' } })
    .then((recipients) => recipients.map((recipient) => recipient.phone));
}
