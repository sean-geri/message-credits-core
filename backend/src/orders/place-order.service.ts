import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InvalidCreditsError } from '../common/errors/invalid-credits.error';
import { lockCustomer } from '../common/lock-customer';
import { Order } from '../database/entities/order.entity';
import { OrderStatus } from '../database/entities/order-status.enum';

@Injectable()
export class PlaceOrderService {
  constructor(private readonly dataSource: DataSource) {}

  async execute(customerId: string, credits: number): Promise<Order> {
    if (!Number.isInteger(credits) || credits <= 0) {
      throw new InvalidCreditsError(credits);
    }

    return this.dataSource.transaction(async (manager) => {
      await lockCustomer(manager, customerId);

      const order = manager.create(Order, {
        customerId,
        credits,
        status: OrderStatus.Active,
      });

      return manager.save(order);
    });
  }
}
