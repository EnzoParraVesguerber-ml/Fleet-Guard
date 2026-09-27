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

  public chartData: ChartData<'bar' | 'line'> = {
    labels: [],
    datasets: []
  };

  public chartOptions: ChartConfiguration['options'] = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      labels: { color: '#E7ECF2' }
    }
  },
    scales: {
    x: {
      title: { display: true, text: 'Tempo (leituras)', color: '#8B97A6' },
      ticks: { color: '#5C6878' },
      grid: { color: '#232E3B' }
    },
    yRpm: {
      type: 'linear',
      position: 'left',
      title: { display: true, text: 'RPM', color: '#8B97A6' },
      ticks: { color: '#5C6878' },
      grid: { color: '#232E3B' }
    },
        yTemp: {
      type: 'linear',
      position: 'right',
      title: { display: false },
      ticks: { display: false },
      grid: { drawOnChartArea: false }
    },
    yVelocity: {
      type: 'linear',
      position: 'right',
      title: { display: false },
      ticks: { display: false },
      grid: { drawOnChartArea: false }
    },
    yOil: {
      type: 'linear',
      position: 'right',
      title: { display: false },
      ticks: { display: false },
      grid: { drawOnChartArea: false }
    },
    yVibration: {
      type: 'linear',
      position: 'right',
      title: { display: false },
      ticks: { display: false },
      grid: { drawOnChartArea: false }
    }
  }
};

  ngOnChanges() {
    const labels = this.rpmHistory.map((_, i) => `${i + 1}`);

    this.chartData = {
      labels,
            datasets: [
        {
          type: 'bar',
          label: 'RPM',
          data: this.rpmHistory,
          backgroundColor: '#4C8FE880',
          yAxisID: 'yRpm'
        },
        {
          type: 'line',
          label: 'Temperatura (°C)',
          data: this.tempHistory,
          borderColor: '#E15C5C',
          backgroundColor: '#E15C5C',
          yAxisID: 'yTemp',
          tension: 0.3
        },
        {
          type: 'line',
          label: 'Velocidade (km/h)',
          data: this.velocityHistory,
          borderColor: '#4CAF7D',
          backgroundColor: '#4CAF7D',
          yAxisID: 'yVelocity',
          tension: 0.3
        },
        {
          type: 'line',
          label: 'Pressão do óleo (kPa)',
          data: this.oilPressureHistory,
          borderColor: '#E8A33D',
          backgroundColor: '#E8A33D',
          yAxisID: 'yOil',
          tension: 0.3
        },
        {
          type: 'line',
          label: 'Vibração (g)',
          data: this.vibrationHistory,
          borderColor: '#9B6BE8',
          backgroundColor: '#9B6BE8',
          yAxisID: 'yVibration',
          tension: 0.3
        }
      ]
    };
  }
}