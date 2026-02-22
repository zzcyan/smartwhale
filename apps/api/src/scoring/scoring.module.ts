import { Module } from '@nestjs/common'
import { AlertsModule } from '../alerts/alerts.module'
import { AccumulationDetector } from './accumulation.detector'
import { ConfluenceDetector } from './confluence.detector'
import { TokenRiskCalculator } from './token-risk.calculator'

@Module({
  imports: [AlertsModule],
  providers: [AccumulationDetector, TokenRiskCalculator, ConfluenceDetector],
  exports: [AccumulationDetector, TokenRiskCalculator, ConfluenceDetector],
})
export class ScoringModule {}
