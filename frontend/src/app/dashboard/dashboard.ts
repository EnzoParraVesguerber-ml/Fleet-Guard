import { Component, inject, OnDestroy, effect, signal, computed, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TelemetriaService, TelemetriaAtual, AlertaHistorico } from '../services/telemetria.service';
import { Subscription } from 'rxjs';
import { FrotaState, TIPO_FALHA_DESC } from '../services/frota-state';
import { SensorCard } from '../sensor-card/sensor-card';
import { Panel } from '../panel/panel';
import { StatusPanel } from '../status-panel/status-panel';
import { PredictionPanel } from '../prediction-panel/prediction-panel';
import { MotorTelemetryChart } from './motor-telemetry-chart/motor-telemetry-chart';
import { Prediction, SensorReading, StatusItem } from '../models/telemetry';

const HIST_SIZE = 30;
const POLL_MS = 2000;
const ALERTS_LIMIT = 20;

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
  alertHistory  = signal<AlertaHistorico[]>([]);
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
  private ultimoTsVisto: number | null = null;
  private requisicoes = new Subscription();
  // [NOVO] Marca que a próxima leitura é a "primeira do veículo" —
  // ela atualiza os cards mas NÃO entra no histórico do gráfico.
  private primeiraLeituraDoVeiculo = true;

  constructor() {
    effect(() => {
      const id = this.state.veiculoSelecionado();
      if (id != null) untracked(() => this.reiniciarPolling(id));
    });
  }

  ngOnDestroy(): void {
    this.pararPolling();
  }

  private reiniciarPolling(veiculoId: number) {
    this.pararPolling();
    this.limparTudo();
    this.ultimoTsVisto = null;
    this.primeiraLeituraDoVeiculo = true;   // [NOVO]
    this.carregando.set(true);
    this.erro.set(null);
    this.buscar(veiculoId);
    this.pollId = setInterval(() => this.buscar(veiculoId), POLL_MS);
  }

  private pararPolling() {
    if (this.pollId) { clearInterval(this.pollId); this.pollId = null; }
    this.requisicoes.unsubscribe();
    this.requisicoes = new Subscription();
  }

  private limparTudo() {
    this.hist.set({ rpm: [], temp: [], velocidade: [], pressao: [], vibracao: [] });
    this.engineSensors.set([]);
    this.brakeSensors.set([]);
    this.prediction.set(null);
    this.motorStatus.set([]);
    this.brakeStatus.set([]);
    this.alertHistory.set([]);
  }

  private buscar(veiculoId: number) {
    this.requisicoes.add(this.api.telemetriaAtual(veiculoId).subscribe({
      next: (l) => {
        this.carregando.set(false);
        this.erro.set(null);

        if (l.timestamp === this.ultimoTsVisto) return;
        this.ultimoTsVisto = l.timestamp;

        // [NOVO] Descarta a 1ª leitura após troca de veículo do histórico do
        // gráfico (evita o "lixo" inicial), mas ainda atualiza os cards.
        if (this.primeiraLeituraDoVeiculo) {
          this.primeiraLeituraDoVeiculo = false;
          this.aplicarLeitura(l, /* atualizarHistorico */ false);
          return;
        }

        this.aplicarLeitura(l, /* atualizarHistorico */ true);
      },
      error: (e) => {
        this.carregando.set(false);
        if (e.status === 404) {
          this.erro.set('Sem telemetria. Popule o banco ou clique em ▶ Simular.');
        } else {
          this.erro.set('Erro ao buscar telemetria da API.');
        }
      },
    }));

    this.requisicoes.add(this.api.listarAlertas(veiculoId, ALERTS_LIMIT).subscribe({
      next: (alertas) => this.alertHistory.set(alertas),
      error: () => {},
    }));
  }

  private aplicarLeitura(l: TelemetriaAtual, atualizarHistorico = true) {
    const tempMotor = l.temp_motor ?? 0;
    const rpm       = l.rpm ?? 0;
    const pressao   = l.pressao_oleo ?? 0;
    const vibracao  = l.vibracao ?? 0;
    const velocidade = l.velocidade_kmh_spn84 ?? 0;

    if (atualizarHistorico) {
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
    }

    const alertaAtivo = (l.alerta_preditivo ?? '').toLowerCase().includes('alerta');

    const tempStatus: 'ok' | 'warn' | 'crit' =
      tempMotor >= 105 ? 'crit' : tempMotor >= 98 ? 'warn' : 'ok';
    const vibStatus: 'ok' | 'warn' | 'crit' =
      vibracao >= 1.0 ? 'crit' : vibracao >= 0.5 ? 'warn' : 'ok';

    const tipoFalhaTexto = this.state.tipoFalhaAtual() !== 'normal'
      ? this.state.tipoFalhaDescricao()
      : 'Falha não classificada';

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
      failureProbability: l.prob_falha ?? (alertaAtivo ? 0.5 : 0.5),
      model: 'Random Forest · janela de 30 leituras',
      updatedAt: 'agora',
      failureType: alertaAtivo ? tipoFalhaTexto : undefined,
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
  }

  // ── Helpers de apresentação do histórico ──
  protected tipoFalhaDescricao(tipo: string): string {
    return TIPO_FALHA_DESC[tipo as keyof typeof TIPO_FALHA_DESC] ?? 'Falha registrada';
  }

  protected formatarProb(p: number): string {
    return Math.round((p ?? 0) * 100).toString();
  }

  protected formatarHora(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch {
      return '—';
    }
  }
}