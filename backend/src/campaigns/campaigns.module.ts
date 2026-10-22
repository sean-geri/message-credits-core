import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from '../database/entities/campaign.entity';
import { Customer } from '../database/entities/customer.entity';
import { Recipient } from '../database/entities/recipient.entity';
import { AddRecipientsService } from './add-recipients.service';
import { CreateCampaignService } from './create-campaign.service';
import { RemoveRecipientsService } from './remove-recipients.service';

@Module({
  imports: [TypeOrmModule.forFeature([Campaign, Customer, Recipient])],
  providers: [
    CreateCampaignService,
    AddRecipientsService,
    RemoveRecipientsService,
  ],
  exports: [
    CreateCampaignService,
    AddRecipientsService,
    RemoveRecipientsService,
  ],
})
export class CampaignsModule {}
