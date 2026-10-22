import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Customer } from './customer.entity';
import { Recipient } from './recipient.entity';
import { CampaignStatus } from './campaign-status.enum';

@Entity('campaigns')
@Index('idx_campaigns_due', ['status', 'scheduledAt'])
@Check(`"status" <> 'scheduled' OR "scheduled_at" IS NOT NULL`)
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @ManyToOne(() => Customer, (customer) => customer.campaigns)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'enum', enum: CampaignStatus, default: CampaignStatus.Draft })
  status: CampaignStatus;

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => Recipient, (recipient) => recipient.campaign)
  recipients: Recipient[];
}
