import { Component, inject, OnDestroy, effect, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TelemetriaService, TelemetriaAtual } from '../services/telemetria';
import { FrotaState } from '../services/frota-state';
import { SensorCard } from '../sensor-card/sensor-card';
import { Panel } from '../panel/panel';
import { StatusPanel } from '../status-panel/status-panel';
import { PredictionPanel } from '../prediction-panel/prediction-panel';
import { MotorTelemetryChart } from './motor-telemetry-chart/motor-telemetry-chart';
import { Prediction, SensorReading, StatusItem } from '../models/telemetry';

interface Alert {
  title: string;
  meta: string;
  time: string;
}

const HIST_SIZE = 30;
const POLL_MS = 2000;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, SensorCard, Panel, StatusPanel, PredictionPanel, MotorTelemetryChart],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnDestroy {
  private api = inject(TelemetriaService);
  protected readonly state = inject(FrotaState);

  engineSensors = signal<SensorReading[]>([]);
  brakeSensors  = signal<SensorReading[]>([]);
  prediction    = signal<Prediction | null>(null);
  motorStatus   = signal<StatusItem[]>([]);
  brakeStatus   = signal<StatusItem[]>([]);
  alerts        = signal<Alert[]>([]);
  carregando    = signal(false);
  erro          = signal<string | null>(null);

  hist = signal({
    rpm:        [] as number[],
    temp:       [] as number[],
    velocidade: [] as number[],
    pressao:    [] as number[],
    vibracao:   [] as number[],
  });

  veiculoLabel = computed(() => {
    const id = this.state.veiculoSelecionado();
    return id == null ? '——' : id.toString().padStart(4, '0');
  });

  private pollId: any = null;

  constructor() {
    effect(() => {
      const id = this.state.veiculoSelecionado();
      if (id != null) this.reiniciarPolling(id);
    });
  }

  ngOnDestroy(): void {
    this.pararPolling();
  }

  private reiniciarPolling(veiculoId: number) {
    this.pararPolling();
    this.limparHistorico();
    this.carregando.set(true);
    this.buscar(veiculoId);
    this.pollId = setInterval(() => this.buscar(veiculoId), POLL_MS);
  }

  private pararPolling() {
    if (this.pollId) { clearInterval(this.pollId); this.pollId = null; }
  }

  private limparHistorico() {
    this.hist.set({ rpm: [], temp: [], velocidade: [], pressao: [], vibracao: [] });
  }

  private buscar(veiculoId: number) {
    this.api.telemetriaAtual(veiculoId).subscribe({
      next: (l) => {
        this.carregando.set(false);
        this.erro.set(null);
        this.aplicarLeitura(l);
      },
      error: (e) => {
        this.carregando.set(false);
        this.erro.set(e.status === 404
          ? 'Sem telemetria ainda. Clique em ▶ Simular na sidebar.'
          : 'Erro ao buscar telemetria da API.');
      },
    });
  }

  private aplicarLeitura(l: TelemetriaAtual) {
    const tempMotor = l.temp_motor ?? 0;
    const rpm       = l.rpm ?? 0;
    const pressao   = l.pressao_oleo ?? 0;
    const vibracao  = l.vibracao ?? 0;
    const velocidade = l.velocidade_kmh_spn84 ?? 0;

    const h = this.hist();
    const trim = (arr: number[], v: number) => {
      const next = [...arr, v];
      return next.length > HIST_SIZE ? next.slice(-HIST_SIZE) : next;
    };
    this.hist.set({
      rpm:        trim(h.rpm, rpm),
      temp:       trim(h.temp, tempMotor),
      velocidade: trim(h.velocidade, velocidade),
      pressao:    trim(h.pressao, pressao),
      vibracao:   trim(h.vibracao, vibracao),
    });

    const alertaAtivo = (l.alerta_preditivo ?? '').toLowerCase().includes('alerta');

    const tempStatus: 'ok' | 'warn' | 'crit' =
      tempMotor >= 105 ? 'crit' : tempMotor >= 98 ? 'warn' : 'ok';
    const vibStatus: 'ok' | 'warn' | 'crit' =
      vibracao >= 1.0 ? 'crit' : vibracao >= 0.5 ? 'warn' : 'ok';

    const snap = this.hist();

    this.engineSensors.set([
      { key: 'temp_motor_spn110', name: 'Temperatura do motor', unit: '°C',
        value: tempMotor.toFixed(1), status: tempStatus,
        statusText: tempStatus === 'ok' ? 'Dentro da faixa esperada'
                  : tempStatus === 'warn' ? 'Acima do normal (limite: 98 °C)'
                  : 'Crítico — risco de superaquecimento',
        history: [...snap.temp] },
      { key: 'rpm_spn190', name: 'Rotação do motor', unit: 'rpm',
        value: rpm.toFixed(0), status: 'ok',
        statusText: 'Dentro da faixa esperada', history: [...snap.rpm] },
      { key: 'pressao_oleo_spn100', name: 'Pressão do óleo', unit: 'kPa',
        value: pressao.toFixed(1), status: 'ok',
        statusText: 'Dentro da faixa esperada', history: [...snap.pressao] },
      { key: 'velocidade_kmh_spn84', name: 'Velocidade', unit: 'km/h',
        value: velocidade.toFixed(1), status: 'ok',
        statusText: 'Em operação', history: [...snap.velocidade] },
    ]);

    this.brakeSensors.set([
      { key: 'vibracao_freio', name: 'Vibração do freio', unit: 'g RMS',
        value: vibracao.toFixed(3), status: vibStatus,
        statusText: vibStatus === 'ok' ? 'Dentro da faixa esperada'
                  : vibStatus === 'warn' ? 'Padrão de vibração elevado'
                  : 'Crítico — possível desgaste de rolamento',
        history: [...snap.vibracao] },
    ]);

    this.prediction.set({
      label: l.alerta_preditivo ?? '—',
      failureProbability: alertaAtivo ? 0.85 : 0.15,
      model: 'Random Forest · janela de 30 leituras',
      updatedAt: 'agora',
    });

    this.motorStatus.set([
      { label: 'Temperatura',       detail: `${tempMotor.toFixed(1)} °C / 98 °C`, status: tempStatus },
      { label: 'Pressão do óleo',   detail: `${pressao.toFixed(0)} kPa`,         status: 'ok' },
      { label: 'Rotação',           detail: `${rpm.toFixed(0)} rpm`,             status: 'ok' },
      { label: 'Derate de proteção',detail: tempMotor >= 108 ? 'ATIVO' : 'inativo',
        status: tempMotor >= 108 ? 'warn' : 'ok' },
    ]);

    this.brakeStatus.set([
      { label: 'Vibração do freio', detail: `${vibracao.toFixed(3)} g RMS`, status: vibStatus },
      { label: 'Velocidade',        detail: `${velocidade.toFixed(1)} km/h`, status: 'ok' },
    ]);

    if (alertaAtivo) {
      this.alerts.set([{
        title: `Alerta preditivo — Ônibus ${this.veiculoLabel()}`,
        meta:  'Modelo identificou padrão de falha iminente',
        time:  'agora',
      }]);
    } else {
      this.alerts.set([]);
    }
  }
}