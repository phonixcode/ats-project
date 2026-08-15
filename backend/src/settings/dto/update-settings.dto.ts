import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

function trimOrKeep(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  return value.trim();
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(['openai', 'claude', 'gemini', 'builtin'])
  reader?: 'openai' | 'claude' | 'gemini' | 'builtin';

  @IsOptional()
  @Transform(({ value }) => trimOrKeep(value))
  @IsString()
  @MaxLength(512)
  openaiApiKey?: string;

  @IsOptional()
  @Transform(({ value }) => trimOrKeep(value))
  @IsString()
  @MaxLength(512)
  claudeApiKey?: string;

  @IsOptional()
  @Transform(({ value }) => trimOrKeep(value))
  @IsString()
  @MaxLength(512)
  geminiApiKey?: string;
}
