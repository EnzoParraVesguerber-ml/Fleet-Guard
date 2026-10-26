import { Component, Input, OnChanges } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';

@Component({
  selector: 'app-motor-telemetry-chart',
  standalone: true,
  imports: [BaseChartDirective],
  templateUrl: './motor-telemetry-chart.html',
  styleUrl: './motor-telemetry-chart.css'
})
export class MotorTelemetryChart implements OnChanges {
  @Input() rpmHistory: number[] = [];
  @Input() tempHistory: number[] = [];
  @Input() velocityHistory: number[] = [];
  @Input() oilPressureHistory: number[] = [];
  @Input() vibrationHistory: number[] = [];

  // ── 1. Motor: temperatura (esq.) + RPM (dir.) ─────────────────
  motorChartData: ChartData<'line'> = { labels: [], datasets: [] };
  motorChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false } },
    scales: {
      x: { display: false, grid: { color: '#1F2937' } },
      yTemp: {
        type: 'linear', position: 'left',
        ticks: { color: '#E15C5C', font: { size: 10 } },
        grid: { color: '#1F2937' },
      },
      yRpm: {
        type: 'linear', position: 'right',
        ticks: { color: '#4C8FE8', font: { size: 10 } },
        grid: { drawOnChartArea: false },
      },
    },
  };

  // ── 2. Freios: vibração + linhas de atenção/crítico ──────────
  brakeChartData: ChartData<'line'> = { labels: [], datasets: [] };
  brakeChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { display: false, grid: { color: '#1F2937' } },
      y: {
        type: 'linear', position: 'left',
        ticks: { color: '#9B6BE8', font: { size: 10 } },
        grid: { color: '#1F2937' },
        suggestedMax: 1.2,
        suggestedMin: 0,
      },
    },
  };

  // ── 3. Operação: velocidade (esq.) + pressão do óleo (dir.) ──
  operationChartData: ChartData<'line'> = { labels: [], datasets: [] };
  operationChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false } },
    scales: {
      x: { display: false, grid: { color: '#1F2937' } },
      yVelocity: {
        type: 'linear', position: 'left',
        ticks: { color: '#4CAF7D', font: { size: 10 } },
        grid: { color: '#1F2937' },
      },
      yOil: {
        type: 'linear', position: 'right',
        ticks: { color: '#E8A33D', font: { size: 10 } },
        grid: { drawOnChartArea: false },
      },
    },
  };

  ngOnChanges() {
    const n = Math.max(this.rpmHistory.length, this.tempHistory.length, this.vibrationHistory.length);
    const labels = Array.from({ length: n }, (_, i) => `${i + 1}`);

    // ── Motor ──
    this.motorChartData = {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Temperatura (°C)',
          data: this.tempHistory,
          borderColor: '#E15C5C',
          backgroundColor: 'rgba(225, 92, 92, 0.12)',
          yAxisID: 'yTemp',
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
          fill: true,
        },
        {
          type: 'line',
          label: 'RPM',
          data: this.rpmHistory,
          borderColor: '#4C8FE8',
          backgroundColor: 'rgba(76, 143, 232, 0.10)',
          yAxisID: 'yRpm',
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    };

    // ── Freios (com thresholds) ──
    const brakeLabels = this.vibrationHistory.map((_, i) => `${i + 1}`);
    this.brakeChartData = {
      labels: brakeLabels,
      datasets: [
        {
          type: 'line',
          label: 'Vibração (g RMS)',
          data: this.vibrationHistory,
          borderColor: '#9B6BE8',
          backgroundColor: 'rgba(155, 107, 232, 0.15)',
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
          fill: true,
        },
        {
          type: 'line',
          label: 'Atenção (0.5)',
          data: Array(brakeLabels.length).fill(0.5),
          borderColor: 'rgba(232, 163, 61, 0.65)',
          borderDash: [5, 4],
          borderWidth: 1,
          pointRadius: 0,
        },
        {
          type: 'line',
          label: 'Crítico (1.0)',
          data: Array(brakeLabels.length).fill(1.0),
          borderColor: 'rgba(225, 92, 92, 0.75)',
          borderDash: [5, 4],
          borderWidth: 1,
          pointRadius: 0,
        },
      ],
    };

    // ── Operação ──
    this.operationChartData = {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Velocidade (km/h)',
          data: this.velocityHistory,
          borderColor: '#4CAF7D',
          backgroundColor: 'rgba(76, 175, 125, 0.10)',
          yAxisID: 'yVelocity',
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          type: 'line',
          label: 'Pressão do óleo (kPa)',
          data: this.oilPressureHistory,
          borderColor: '#E8A33D',
          backgroundColor: 'rgba(232, 163, 61, 0.10)',
          yAxisID: 'yOil',
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    };
  }
}