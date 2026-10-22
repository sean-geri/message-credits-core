import { config } from 'dotenv';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { Customer } from './entities/customer.entity';
import { DispatchResult } from './entities/dispatch-result.entity';
import { Message } from './entities/message.entity';
import { Order } from './entities/order.entity';
import { Recipient } from './entities/recipient.entity';

config({ path: join(__dirname, '..', '..', '.env') });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [Customer, Order, Campaign, Recipient, Message, DispatchResult],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});
