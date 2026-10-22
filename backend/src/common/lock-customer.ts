import { EntityManager } from 'typeorm';
import { Customer } from '../database/entities/customer.entity';
import { CustomerNotFoundError } from './errors/customer-not-found.error';

export async function lockCustomer(
  em: EntityManager,
  customerId: string,
): Promise<Customer> {
  const customer = await em.findOne(Customer, {
    where: { id: customerId },
    lock: { mode: 'pessimistic_write' },
  });

  if (!customer) {
    throw new CustomerNotFoundError(customerId);
  }

  return customer;
}
