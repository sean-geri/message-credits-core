import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Campaign } from './campaign.entity';

/**
 * No balance column: balance is derived from orders, campaigns and messages.
 * This row is the lock point (SELECT ... FOR UPDATE) for every credit-changing operation.
 */
@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => Order, (order) => order.customer)
  orders: Order[];

  @OneToMany(() => Campaign, (campaign) => campaign.customer)
  campaigns: Campaign[];
}
