import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from '../database/entities/campaign.entity';
import { Customer } from '../database/entities/customer.entity';
import { Recipient } from '../database/entities/recipient.entity';
import { AddRecipientsService } from './add-recipients.service';
import { CancelScheduleService } from './cancel-schedule.service';
import { CreateCampaignService } from './create-campaign.service';
import { RemoveRecipientsService } from './remove-recipients.service';
import { ScheduleCampaignService } from './schedule-campaign.service';

@Module({
  imports: [TypeOrmModule.forFeature([Campaign, Customer, Recipient])],
  providers: [
    CreateCampaignService,
    AddRecipientsService,
    RemoveRecipientsService,
    ScheduleCampaignService,
    CancelScheduleService,
  ],
  exports: [
    CreateCampaignService,
    AddRecipientsService,
    RemoveRecipientsService,
    ScheduleCampaignService,
    CancelScheduleService,
  ],
})
export class CampaignsModule {}
