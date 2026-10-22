import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Campaign } from './campaign.entity';
import { Recipient } from './recipient.entity';
import { MessageStatus } from './message-status.enum';

@Entity('messages')
@Unique('uq_messages_campaign_recipient', ['campaignId', 'recipientId']) // no double-send
@Index('idx_messages_campaign_status', ['campaignId', 'status'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string;

  @ManyToOne(() => Campaign)
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId: string;

  @ManyToOne(() => Recipient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'recipient_id' })
  recipient: Recipient;

  @Column({ type: 'enum', enum: MessageStatus, default: MessageStatus.Pending })
  status: MessageStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
