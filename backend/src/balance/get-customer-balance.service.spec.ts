import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AddRecipientsService } from '../campaigns/add-recipients.service';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { CreateCampaignService } from '../campaigns/create-campaign.service';
import { ScheduleCampaignService } from '../campaigns/schedule-campaign.service';
import { CustomerNotFoundError } from '../common/errors/customer-not-found.error';
import { Campaign } from '../database/entities/campaign.entity';
import { Customer } from '../database/entities/customer.entity';
import { DispatchResult } from '../database/entities/dispatch-result.entity';
import { Message } from '../database/entities/message.entity';
import { Order } from '../database/entities/order.entity';
import { Recipient } from '../database/entities/recipient.entity';
import { CancelOrderService } from '../orders/cancel-order.service';
import { OrdersModule } from '../orders/orders.module';
import { PlaceOrderService } from '../orders/place-order.service';
import { RecordDispatchResultService } from '../sending/record-dispatch-result.service';
import { SendDueCampaignsService } from '../sending/send-due-campaigns.service';
import { SendingModule } from '../sending/sending.module';
import { createCustomer } from '../../test/utils/create-customer';
import { resetDb } from '../../test/utils/reset-db';
import { BalanceModule } from './balance.module';
import { GetCustomerBalanceService } from './get-customer-balance.service';

describe('GetCustomerBalanceService', () => {
  let module: TestingModule;
  let balance: GetCustomerBalanceService;
  let placeOrder: PlaceOrderService;
  let cancelOrder: CancelOrderService;
  let createCampaign: CreateCampaignService;
  let addRecipients: AddRecipientsService;
  let scheduleCampaign: ScheduleCampaignService;
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
        BalanceModule,
        OrdersModule,
        CampaignsModule,
        SendingModule,
      ],
    }).compile();

    balance = module.get(GetCustomerBalanceService);
    placeOrder = module.get(PlaceOrderService);
    cancelOrder = module.get(CancelOrderService);
    createCampaign = module.get(CreateCampaignService);
    addRecipients = module.get(AddRecipientsService);
    scheduleCampaign = module.get(ScheduleCampaignService);
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

  it('reports zeros for a fresh customer', async () => {
    const customer = await createCustomer(dataSource);

    await expect(balance.execute(customer.id)).resolves.toEqual({
      purchased: 0,
      reserved: 0,
      inFlight: 0,
      spent: 0,
      available: 0,
      shortfall: 0,
      atRiskCampaigns: [],
      cancelledOrders: [],
    });
  });

  it('reports the correct numbers at each stage', async () => {
    const customer = await createCustomer(dataSource);
    await placeOrder.execute(customer.id, 3);

    await expect(balance.execute(customer.id)).resolves.toMatchObject({
      purchased: 3,
      reserved: 0,
      inFlight: 0,
      spent: 0,
      available: 3,
      shortfall: 0,
      atRiskCampaigns: [],
    });

    const campaign = await createCampaign.execute(customer.id, 'Launch', 'Hi');
    await addRecipients.execute(campaign.id, ['+15551230001', '+15551230002']);
    await scheduleCampaign.execute(
      campaign.id,
      new Date('2026-02-01T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
    );

    await expect(balance.execute(customer.id)).resolves.toMatchObject({
      purchased: 3,
      reserved: 2,
      inFlight: 0,
      spent: 0,
      available: 1,
      shortfall: 0,
      atRiskCampaigns: [],
    });

    await sendDueCampaigns.execute(new Date('2026-02-02T00:00:00.000Z'));

    await expect(balance.execute(customer.id)).resolves.toMatchObject({
      purchased: 3,
      reserved: 0,
      inFlight: 2,
      spent: 0,
      available: 1,
      shortfall: 0,
      atRiskCampaigns: [],
    });

    const messages = await dataSource.getRepository(Message).find({
      where: { campaignId: campaign.id },
      order: { id: 'ASC' },
    });
    await recordDispatchResult.execute(
      messages[0].id,
      'accepted',
      new Date('2026-02-03T00:00:00.000Z'),
    );
    await recordDispatchResult.execute(
      messages[1].id,
      'rejected',
      new Date('2026-02-03T01:00:00.000Z'),
    );

    await expect(balance.execute(customer.id)).resolves.toMatchObject({
      purchased: 3,
      reserved: 0,
      inFlight: 0,
      spent: 1,
      available: 2,
      shortfall: 0,
      atRiskCampaigns: [],
    });
  });

  it('shows the shortfall and the cancelled order after a scheduled campaign loses its credit', async () => {
    const customer = await createCustomer(dataSource);
    const order = await placeOrder.execute(customer.id, 2);
    const sendAt = new Date('2026-03-01T00:00:00.000Z');
    const cancelledAt = new Date('2026-03-02T00:00:00.000Z');
    const campaign = await createCampaign.execute(customer.id, 'Launch', 'Hi');
    await addRecipients.execute(campaign.id, ['+15551230001', '+15551230002']);
    await scheduleCampaign.execute(
      campaign.id,
      sendAt,
      new Date('2026-01-01T00:00:00.000Z'),
    );
    await cancelOrder.execute(order.id, cancelledAt);

    await expect(balance.execute(customer.id)).resolves.toEqual({
      purchased: 0,
      reserved: 2,
      inFlight: 0,
      spent: 0,
      available: -2,
      shortfall: 2,
      atRiskCampaigns: [
        {
          id: campaign.id,
          name: 'Launch',
          scheduledAt: sendAt,
          recipients: 2,
          missingCredits: 2,
        },
      ],
      cancelledOrders: [
        {
          id: order.id,
          credits: 2,
          cancelledAt,
        },
      ],
    });
  });

  it('marks only the later scheduled campaign at risk when credit covers the earlier one', async () => {
    const customer = await createCustomer(dataSource);
    await placeOrder.execute(customer.id, 2);
    const extra = await placeOrder.execute(customer.id, 1);
    const earlierAt = new Date('2026-04-01T00:00:00.000Z');
    const laterAt = new Date('2026-04-02T00:00:00.000Z');
    const earlier = await createCampaign.execute(customer.id, 'Earlier', 'Hi');
    await addRecipients.execute(earlier.id, ['+15551230001', '+15551230002']);
    await scheduleCampaign.execute(
      earlier.id,
      earlierAt,
      new Date('2026-01-01T00:00:00.000Z'),
    );
    const later = await createCampaign.execute(customer.id, 'Later', 'Hi');
    await addRecipients.execute(later.id, ['+15551230003']);
    await scheduleCampaign.execute(
      later.id,
      laterAt,
      new Date('2026-01-02T00:00:00.000Z'),
    );
    await cancelOrder.execute(extra.id, new Date('2026-04-03T00:00:00.000Z'));

    const result = await balance.execute(customer.id);

    expect(result.atRiskCampaigns).toEqual([
      {
        id: later.id,
        name: 'Later',
        scheduledAt: laterAt,
        recipients: 1,
        missingCredits: 1,
      },
    ]);
  });

  it('throws when the customer does not exist', async () => {
    const customerId = randomUUID();

    await expect(balance.execute(customerId)).rejects.toBeInstanceOf(
      CustomerNotFoundError,
    );
  });
});
