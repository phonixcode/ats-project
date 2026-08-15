import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ProcessRemainingDto {
  @IsOptional()
  @IsUUID()
  jobId?: string;

  @IsOptional()
  @IsDateString()
  postedFrom?: string;

  @IsOptional()
  @IsDateString()
  postedTo?: string;
}
