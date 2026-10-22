import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OrderAlreadyCancelledError } from '../common/errors/order-already-cancelled.error';
import { OrderNotFoundError } from '../common/errors/order-not-found.error';
import { Campaign } from '../database/entities/campaign.entity';
import { Customer } from '../database/entities/customer.entity';
import { DispatchResult } from '../database/entities/dispatch-result.entity';
import { Message } from '../database/entities/message.entity';
import { Order } from '../database/entities/order.entity';
import { OrderStatus } from '../database/entities/order-status.enum';
import { Recipient } from '../database/entities/recipient.entity';
import { createCustomer } from '../../test/utils/create-customer';
import { resetDb } from '../../test/utils/reset-db';
import { CancelOrderService } from './cancel-order.service';
import { OrdersModule } from './orders.module';

describe('CancelOrderService', () => {
  let module: TestingModule;
  let service: CancelOrderService;
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
        OrdersModule,
      ],
    }).compile();

    service = module.get(CancelOrderService);
    dataSource = module.get(DataSource);
  });

  beforeEach(async () => {
    await resetDb(dataSource);
  });

  afterAll(async () => {
    await module.close();
  });

  it('cancels an active order and stores the given time', async () => {
    const customer = await createCustomer(dataSource);
    const created = await dataSource.getRepository(Order).save({
      customerId: customer.id,
      credits: 10,
      status: OrderStatus.Active,
    });
    const now = new Date('2026-01-02T03:04:05.000Z');

    const cancelled = await service.execute(created.id, now);
    const stored = await dataSource.getRepository(Order).findOneByOrFail({
      id: created.id,
    });

    expect(cancelled.status).toBe(OrderStatus.Cancelled);
    expect(cancelled.cancelledAt).toEqual(now);
    expect(stored.status).toBe(OrderStatus.Cancelled);
    expect(stored.cancelledAt).toEqual(now);
  });

  it('throws OrderNotFoundError when the order does not exist', async () => {
    await expect(
      service.execute(randomUUID(), new Date('2026-01-02T03:04:05.000Z')),
    ).rejects.toBeInstanceOf(OrderNotFoundError);
  });

  it('throws OrderAlreadyCancelledError when the order is already cancelled', async () => {
    const customer = await createCustomer(dataSource);
    const created = await dataSource.getRepository(Order).save({
      customerId: customer.id,
      credits: 10,
      status: OrderStatus.Cancelled,
      cancelledAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    await expect(
      service.execute(created.id, new Date('2026-01-02T03:04:05.000Z')),
    ).rejects.toBeInstanceOf(OrderAlreadyCancelledError);

    const stored = await dataSource.getRepository(Order).findOneByOrFail({
      id: created.id,
    });
    expect(stored.cancelledAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });
});
