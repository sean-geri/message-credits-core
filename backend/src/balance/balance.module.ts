import { Module } from '@nestjs/common';
import { GetCustomerBalanceService } from './get-customer-balance.service';

@Module({
  providers: [GetCustomerBalanceService],
  exports: [GetCustomerBalanceService],
})
export class BalanceModule {}
