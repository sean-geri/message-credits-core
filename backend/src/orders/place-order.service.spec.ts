import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CustomerNotFoundError } from '../common/errors/customer-not-found.error';
import { InvalidCreditsError } from '../common/errors/invalid-credits.error';
import { Campaign } from '../database/entities/campaign.entity';
import { Customer } from '../database/entities/customer.entity';
import { DispatchResult } from '../database/entities/dispatch-result.entity';
import { Message } from '../database/entities/message.entity';
import { Order } from '../database/entities/order.entity';
import { OrderStatus } from '../database/entities/order-status.enum';
import { Recipient } from '../database/entities/recipient.entity';
import { createCustomer } from '../../test/utils/create-customer';
import { resetDb } from '../../test/utils/reset-db';
import { OrdersModule } from './orders.module';
import { PlaceOrderService } from './place-order.service';

describe('PlaceOrderService', () => {
  let module: TestingModule;
  let service: PlaceOrderService;
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

    service = module.get(PlaceOrderService);
    dataSource = module.get(DataSource);
  });

  beforeEach(async () => {
    await resetDb(dataSource);
  });

  afterAll(async () => {
    await module.close();
  });

  it('places an order and stores it as active with the right credits', async () => {
    const customer = await createCustomer(dataSource);

    const order = await service.execute(customer.id, 25);
    const stored = await dataSource.getRepository(Order).findOneByOrFail({
      id: order.id,
    });

    expect(stored.customerId).toBe(customer.id);
    expect(stored.credits).toBe(25);
    expect(stored.status).toBe(OrderStatus.Active);
  });

  it.each([0, -5, 1.5])('rejects %s credits', async (credits) => {
    const customer = await createCustomer(dataSource);
    const error = await service
      .execute(customer.id, credits)
      .then(() => null)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(InvalidCreditsError);
    expect(error).toMatchObject({ code: 'INVALID_CREDITS' });
    await expect(dataSource.getRepository(Order).count()).resolves.toBe(0);
  });

  it('throws CustomerNotFoundError for an unknown customer', async () => {
    await expect(service.execute(randomUUID(), 10)).rejects.toBeInstanceOf(
      CustomerNotFoundError,
    );
  });
});
