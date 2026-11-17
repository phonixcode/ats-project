import { IsEnum } from 'class-validator';
import { HumanDecision } from '@prisma/client';
import { BulkApplicationsDto } from './bulk-applications.dto';

export class BulkReviewDto extends BulkApplicationsDto {
  @IsEnum(HumanDecision)
  humanDecision: HumanDecision;
}
