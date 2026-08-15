import { Module } from '@nestjs/common';
import { ScoresService } from './scores.service';
import { EnsembleScoringService } from './ensemble-scoring.service';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [LlmModule],
  providers: [ScoresService, EnsembleScoringService],
  exports: [ScoresService, EnsembleScoringService],
})
export class ScoresModule {}
