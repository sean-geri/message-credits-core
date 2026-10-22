import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CustomerNotFoundError } from '../common/errors/customer-not-found.error';
import { EmptyCampaignFieldError } from '../common/errors/empty-campaign-field.error';
import { Campaign } from '../database/entities/campaign.entity';
import { CampaignStatus } from '../database/entities/campaign-status.enum';
import { Customer } from '../database/entities/customer.entity';

@Injectable()
export class CreateCampaignService {
  constructor(private readonly dataSource: DataSource) {}

  async execute(
    customerId: string,
    name: string,
    body: string,
  ): Promise<Campaign> {
    const trimmedName = name.trim();
    const trimmedBody = body.trim();

    if (!trimmedName) {
      throw new EmptyCampaignFieldError('name');
    }

    if (!trimmedBody) {
      throw new EmptyCampaignFieldError('body');
    }

    const customer = await this.dataSource.getRepository(Customer).findOne({
      where: { id: customerId },
    });

    if (!customer) {
      throw new CustomerNotFoundError(customerId);
    }

    return this.dataSource.getRepository(Campaign).save({
      customerId,
      name: trimmedName,
      body: trimmedBody,
      status: CampaignStatus.Draft,
    });
  }
}
