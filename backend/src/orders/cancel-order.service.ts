import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OrderAlreadyCancelledError } from '../common/errors/order-already-cancelled.error';
import { OrderNotFoundError } from '../common/errors/order-not-found.error';
import { lockCustomer } from '../common/lock-customer';
import { Order } from '../database/entities/order.entity';
import { OrderStatus } from '../database/entities/order-status.enum';

@Injectable()
export class CancelOrderService {
  constructor(private readonly dataSource: DataSource) {}

  async execute(orderId: string, now: Date): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(Order, {
        where: { id: orderId },
      });

      if (!existing) {
        throw new OrderNotFoundError(orderId);
      }

      await lockCustomer(manager, existing.customerId);

      const order = await manager.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new OrderNotFoundError(orderId);
      }

      if (order.status === OrderStatus.Cancelled) {
        throw new OrderAlreadyCancelledError(orderId);
      }

      order.status = OrderStatus.Cancelled;
      order.cancelledAt = now;

      return manager.save(order);
    });
  }
}
