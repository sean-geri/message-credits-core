import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../database/entities/customer.entity';
import { Order } from '../database/entities/order.entity';
import { CancelOrderService } from './cancel-order.service';
import { PlaceOrderService } from './place-order.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Customer])],
  providers: [PlaceOrderService, CancelOrderService],
  exports: [PlaceOrderService, CancelOrderService],
})
export class OrdersModule {}
