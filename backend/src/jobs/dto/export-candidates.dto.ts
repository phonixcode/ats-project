import { IsIn, IsOptional } from 'class-validator';
import { EXPORT_DECISIONS } from '../export-csv';
import type { ExportDecision } from '../export-csv';

export class ExportCandidatesDto {
  @IsOptional()
  @IsIn(EXPORT_DECISIONS, {
    message:
      'Choose who to export: shortlist, maybe later, not this time, or everyone.',
  })
  decision?: ExportDecision;
}
