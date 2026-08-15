import { IsEnum, IsBoolean, IsOptional, IsString } from 'class-validator';
import { HumanDecision } from '@prisma/client';

export class CreateReviewDto {
  @IsEnum(HumanDecision)
  humanDecision: HumanDecision;

  @IsBoolean()
  @IsOptional()
  overrodeBucket?: boolean;

  @IsString()
  @IsOptional()
  note?: string;
}
