import { DataSource } from 'typeorm';
import { Customer } from '../../src/database/entities/customer.entity';

export async function createCustomer(
  dataSource: DataSource,
  name = 'Test customer',
): Promise<Customer> {
  const repository = dataSource.getRepository(Customer);

  return repository.save(repository.create({ name }));
}
