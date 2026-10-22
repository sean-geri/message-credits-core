import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from '../database/entities/campaign.entity';
import { DispatchResult } from '../database/entities/dispatch-result.entity';
import { Message } from '../database/entities/message.entity';
import { Recipient } from '../database/entities/recipient.entity';
import { RecordDispatchResultService } from './record-dispatch-result.service';
import { SendDueCampaignsService } from './send-due-campaigns.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Campaign, Recipient, Message, DispatchResult]),
  ],
  providers: [SendDueCampaignsService, RecordDispatchResultService],
  exports: [SendDueCampaignsService, RecordDispatchResultService],
})
export class SendingModule {}
