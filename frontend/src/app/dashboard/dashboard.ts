import { MotorTelemetryChart } from './motor-telemetry-chart/motor-telemetry-chart';
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SensorCard } from '../sensor-card/sensor-card';

// Define o tipo exato exigido pelo componente filho
type SensorStatus = 'ok' | 'warn' | 'crit';

interface SensorData {
  value: string;
  status: SensorStatus;
  statusText: string;
  history: number[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, SensorCard, MotorTelemetryChart],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard implements OnInit, OnDestroy {
  // Inicialização com as tipagens corretas ('string' e SensorStatus)
  engineTemp: SensorData = { value: '0.0', status: 'ok', statusText: 'Normal', history: [] };
  rpm: SensorData = { value: '0', status: 'ok', statusText: 'Normal', history: [] };
  oilPressure: SensorData = { value: '0.0', status: 'ok', statusText: 'Normal', history: [] };
  vibration: SensorData = { value: '0.000', status: 'ok', statusText: 'Normal', history: [] };
  velocity: SensorData = { value: '0', status: 'ok', statusText: 'Normal', history: [] };
  
  alerts: Array<{title: string, meta: string, time: string}> = [];
  
  private pollingInterval: any;
  private readonly VEICULO_ID = 0;
  private fmt = new Intl.NumberFormat('pt-BR');
  private readonly API_URL = `http://127.0.0.1:5000/api/telemetria/atual/${this.VEICULO_ID}`;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.fetchData();
    this.pollingInterval = setInterval(() => this.fetchData(), 3000);
  }

  ngOnDestroy() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  private readonly MAX_HISTORY = 30;

  private pushHistory(target: SensorData, newValue: number) {
    target.history = [...target.history, newValue].slice(-this.MAX_HISTORY);
  }

  fetchData() {
    console.log('🔵 Buscando telemetria em', this.API_URL);

    this.http.get<any>(this.API_URL).subscribe({
      next: (data) => {
        console.log('🟢 Resposta recebida:', data);

        this.engineTemp.value = data.temp_motor.toFixed(1);
        this.engineTemp.status = data.temp_motor > 105 ? 'warn' : 'ok';
        this.engineTemp.statusText = data.temp_motor > 105 ? 'Atenção' : 'Normal';

        this.rpm.value = this.fmt.format(Math.round(data.rpm));
        if (data.rpm > 2000) {
          this.rpm.status = 'warn';
          this.rpm.statusText = 'Alta';
        } else {
          this.rpm.status = 'ok';
          this.rpm.statusText = 'Normal';
        }

        this.oilPressure.value = data.pressao_oleo.toFixed(1);
        this.oilPressure.status = data.pressao_oleo < 200 ? 'warn' : 'ok';
        this.oilPressure.statusText = data.pressao_oleo < 200 ? 'Atenção' : 'Normal';

        this.vibration.value = data.vibracao.toFixed(3);
        this.vibration.status = data.vibracao > 0.15 ? 'warn' : 'ok';
        this.vibration.statusText = data.vibracao > 0.15 ? 'Atenção' : 'Normal';
        this.velocity.value = data.velocidade_kmh_spn84.toFixed(1);
        if (data.velocidade_kmh_spn84 > 60) {
          this.velocity.status = 'warn';
          this.velocity.statusText = 'Alta';
        } else {
          this.velocity.status = 'ok';
          this.velocity.statusText = 'Normal';
        }

        this.pushHistory(this.engineTemp, data.temp_motor);
        this.pushHistory(this.rpm,         data.rpm);
        this.pushHistory(this.oilPressure, data.pressao_oleo);
        this.pushHistory(this.vibration,   data.vibracao);
        this.pushHistory(this.velocity,    data.velocidade_kmh_spn84);

        if (data.alerta_preditivo !== "Operação Normal") {
          this.engineTemp.status = 'crit';
          this.vibration.status = 'crit';
          this.engineTemp.statusText = 'Crítico';
          this.vibration.statusText = 'Crítico';
          this.alerts = [{
            title: "Alerta de IA: Falha Iminente",
            meta: "Modelo detectou anomalia na vibração/temperatura",
            time: new Date().toLocaleTimeString()
          }];
        } else {
          this.alerts = [];
        }

        this.cdr.detectChanges();   // 🔥 OBRIGATÓRIO em modo zoneless
      },
      error: (err) => {
        console.error('🔴 ERRO no fetch:', err);
      }
    });
  }
}