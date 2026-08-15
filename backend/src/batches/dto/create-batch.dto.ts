import { IsUUID } from 'class-validator';

export class CreateBatchDto {
  @IsUUID()
  jobId: string;
}
