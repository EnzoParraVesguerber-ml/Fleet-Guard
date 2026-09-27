import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Panel } from '../panel/panel';
import { Prediction, Status } from '../models/telemetry';

/**
 * Container da predição do modelo de ML.
 * Sem `prediction` definido, mostra o estado vazio (útil enquanto a API do modelo não existe).
 */
@Component({
  selector: 'app-prediction-panel',
  standalone: true,
  imports: [CommonModule, Panel],
  templateUrl: './prediction-panel.html',
  styleUrl: './prediction-panel.css'
})
export class PredictionPanel {
  @Input() prediction: Prediction | null = null;

  /** Limiares de cor da barra de probabilidade de falha */
  @Input() warnAt = 0.3;
  @Input() critAt = 0.6;

  get percent(): number {
    return Math.round((this.prediction?.failureProbability ?? 0) * 100);
  }

  get status(): Status {
    const p = this.prediction?.failureProbability ?? 0;
    if (p >= this.critAt) return 'crit';
    if (p >= this.warnAt) return 'warn';
    return 'ok';
  }
}
