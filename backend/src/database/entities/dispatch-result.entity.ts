import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Message } from './message.entity';

export type DispatchOutcome = 'accepted' | 'rejected';

/** Optional append-only log of every raw dispatcher report (duplicates and out-of-order included). */
@Entity('dispatch_results')
export class DispatchResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'message_id', type: 'uuid' })
  messageId: string;

  @ManyToOne(() => Message)
  @JoinColumn({ name: 'message_id' })
  message: Message;

  @Column({
    type: 'enum',
    enum: ['accepted', 'rejected'],
    enumName: 'dispatch_outcome',
  })
  result: DispatchOutcome;

  @Column({ name: 'reported_at', type: 'timestamptz' })
  reportedAt: Date;

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;
}
