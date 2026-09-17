import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sensor-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sensor-card.html',
  styleUrl: './sensor-card.css'
})
export class SensorCard implements OnChanges {
  /** Nome exibido do sensor, ex: "Temperatura do motor" */
  @Input() name = '';
  /** Unidade curta pro chip do topo, ex: "°C" */
  @Input() unit = '';
  /** Valor atual formatado, ex: "104" */
  @Input() value = '';
  /** Status do sensor: controla cor do card e da linha do gráfico */
  @Input() status: 'ok' | 'warn' | 'crit' = 'ok';
  /** Texto da linha de status abaixo do valor */
  @Input() statusText = '';
  /** Histórico de leituras (mais antiga -> mais recente) usado para desenhar o gráfico */
  @Input() history: number[] = [];

  private readonly width = 280;
  private readonly height = 64;
  private readonly padY = 6;

  linePoints = '';
  areaPoints = '';
  lastPoint: { x: number; y: number } | null = null;

  ngOnChanges(): void {
    this.buildChart();
  }

  private buildChart(): void {
    if (!this.history || this.history.length < 2) {
      this.linePoints = '';
      this.areaPoints = '';
      this.lastPoint = null;
      return;
    }

    const min = Math.min(...this.history);
    const max = Math.max(...this.history);
    const range = max - min || 1;
    const stepX = this.width / (this.history.length - 1);

    const coords = this.history.map((v, i) => {
      const x = i * stepX;
      const normalized = (v - min) / range;
      const y = this.height - this.padY - normalized * (this.height - this.padY * 2);
      return { x, y };
    });

    this.linePoints = coords.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    this.areaPoints =
      `0,${this.height} ` + this.linePoints + ` ${this.width},${this.height}`;

    this.lastPoint = coords[coords.length - 1];
  }
}