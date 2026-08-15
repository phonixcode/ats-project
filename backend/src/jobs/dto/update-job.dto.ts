import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { EmploymentType, SeniorityLevel, WorkplaceType } from '@prisma/client';
import { CreateJobDto } from './create-job.dto';

function splitList(value: unknown): string[] | unknown {
  if (value === undefined || value === null) return value;
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return value;
}

export class UpdateJobDto implements Partial<CreateJobDto> {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsEnum(WorkplaceType)
  workplace?: WorkplaceType;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsEnum(SeniorityLevel)
  seniority?: SeniorityLevel;

  @IsOptional()
  @Transform(({ value }) => splitList(value))
  @IsArray()
  @IsString({ each: true })
  mustHaves?: string[];

  @IsOptional()
  @Transform(({ value }) => splitList(value))
  @IsArray()
  @IsString({ each: true })
  niceToHaves?: string[];

  @IsOptional()
  @Transform(({ value }) => splitList(value))
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  minYears?: number;

  @IsOptional()
  @IsString()
  education?: string;

  @IsOptional()
  @IsNumber()
  salaryMin?: number;

  @IsOptional()
  @IsNumber()
  salaryMax?: number;

  @IsOptional()
  @IsString()
  salaryCurrency?: string;

  @IsOptional()
  @IsDateString()
  postedAt?: string;

  @IsOptional()
  @IsDateString()
  closesAt?: string;
}
