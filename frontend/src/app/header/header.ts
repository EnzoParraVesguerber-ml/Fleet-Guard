import {
  Component, inject, signal, computed,
  OnInit, OnDestroy, HostListener, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FrotaState } from '../services/frota-state';
import { TelemetriaService, Veiculo } from '../services/telemetria.service';
import { SimulacaoService } from '../services/simulacao.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class Header implements OnInit, OnDestroy {
  protected readonly state = inject(FrotaState);
  private api = inject(TelemetriaService);
  // [INTEGRAÇÃO - ITEM 2] Iniciar, reiniciar e parar agora usam o serviço de POST.
  // As consultas de veículos, resumo e status continuam em TelemetriaService.
  private simulacao = inject(SimulacaoService);
  private el  = inject(ElementRef);

  veiculos    = signal<Veiculo[]>([]);
  fleetOnline = signal(0);
  fleetTotal  = signal(0);
  alertCount  = signal(0);
  intervalo   = signal(0.2);

  dropdownAberto = signal(false);

  private pollResumo: any = null;
  private pollStatus: any = null;

  // ── Veículo selecionado, já como objeto, pra facilitar o template ──
  veiculoSelecionado = computed<Veiculo | null>(() => {
    const id = this.state.veiculoSelecionado();
    if (id == null) return null;
    return this.veiculos().find(v => v.id === id) ?? null;
  });

  veiculoSelecionadoTemFalha = computed(() => {
    const v = this.veiculoSelecionado();
    return v ? v.tipo_falha !== 'normal' : false;
  });

  ngOnInit() {
    this.carregarVeiculos();
    this.atualizarResumo();
    this.atualizarStatus();
    this.pollResumo = setInterval(() => this.atualizarResumo(), 5000);
    this.pollStatus = setInterval(() => this.atualizarStatus(), 1000);
  }

  ngOnDestroy() {
    if (this.pollResumo) clearInterval(this.pollResumo);
    if (this.pollStatus) clearInterval(this.pollStatus);
  }

  // Fecha o dropdown se clicar em qualquer lugar fora dele
  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    if (this.dropdownAberto() && !this.el.nativeElement.contains(e.target)) {
      this.dropdownAberto.set(false);
    }
  }

  toggleDropdown() {
    this.dropdownAberto.update(v => !v);
  }

  selecionar(id: number) {
  this.dropdownAberto.set(false);

    const anterior = this.state.veiculoSelecionado();
    if (id === anterior) return;

    // [NOVO] Para a simulação ANTES de trocar de veículo.
    // A UI fica pronta para o usuário clicar em "Simular" no veículo novo.
    if (this.state.simulacaoAtiva()) {
      this.simulacao.pararSimulacao().subscribe({
        next: () => this.state.simulacaoAtiva.set(false),
        // Em caso de erro, o polling de status (1s) sincroniza sozinho.
        error: () => {},
      });
    }

    const v = this.veiculos().find(x => x.id === id);
    this.state.selecionar(id, v?.tipo_falha ?? 'normal');
    }

  private carregarVeiculos() {
    this.api.listarVeiculos().subscribe({
      next: (vs) => {
        this.veiculos.set(vs);
        if (vs.length && this.state.veiculoSelecionado() == null) {
          this.state.selecionar(vs[0].id, vs[0].tipo_falha);   // ← passa o tipo
        }
      },
    });
  }

  private atualizarResumo() {
    this.api.resumoFrota().subscribe({
      next: (r) => {
        this.fleetTotal.set(r.total);
        this.fleetOnline.set(r.operando_normal);
        this.alertCount.set(r.em_alerta);
      },
      error: () => {},
    });
  }

  private atualizarStatus() {
    this.api.statusSimulacao().subscribe({
      next: (s) => this.state.simulacaoAtiva.set(!!s.ativo),
      error: () => {},
    });
  }

  onSimular() {
    const id = this.state.veiculoSelecionado();
    if (id == null) return;
    this.simulacao.iniciarSimulacao(id, this.intervalo()).subscribe({
      next: () => this.state.simulacaoAtiva.set(true),
      error: (e) => console.error('Erro ao iniciar:', e),
    });
  }

  onParar() {
    this.simulacao.pararSimulacao().subscribe({
      next: () => this.state.simulacaoAtiva.set(false),
    });
  }

  /** Rótulo amigável de cada veículo (usado no dropdown e no badge) */
  labelVeiculo(v: Veiculo): string {
    const n = `#${v.id.toString().padStart(3, '0')}`;
    switch (v.tipo_falha) {
      case 'motor':     return `${n} — falha de motor`;
      case 'freio':     return `${n} — falha de freio`;
      case 'rolamento': return `${n} — desgaste de rolamento`;
      default:          return `${n} — normal`;
    }
  }

  /** Usado quando nenhum veículo está selecionado ainda */
  labelSelecionado(): string {
    const v = this.veiculoSelecionado();
    return v ? this.labelVeiculo(v) : 'Carregando…';
  }
}
