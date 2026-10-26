import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const API = 'http://127.0.0.1:5000/api';

export interface TelemetriaAtual {
  temp_motor: number;
  rpm: number;
  pressao_oleo: number;
  vibracao: number;
  velocidade_kmh_spn84: number;
  alerta_preditivo: string;
  timestamp: number;
  prob_falha: number | null;
}

export interface ResumoFrota {
  total: number;
  operando_normal: number;
  em_alerta: number;
  com_dados: number;
}

export interface StatusSimulacao {
  ativo: boolean;
  veiculo_id: number | null;
  posicao: number;
  total: number;
  intervalo_s: number;
}

export interface Veiculo {
  id: number;
  ativo: boolean;
  ultimo_alerta: string | null;
  tipo_falha: 'normal' | 'motor' | 'freio' | 'rolamento';
}

// [HISTÓRICO] Espelha a resposta de GET /api/veiculos/<id>/alertas
export interface AlertaHistorico {
  id: number;
  timestamp: number;
  classe_prevista: string;
  probabilidade: number;
  tipo_falha: 'motor' | 'freio' | 'rolamento' | 'desconhecido';
  criado_em: string;
}

@Injectable({ providedIn: 'root' })
export class TelemetriaService {
  private http = inject(HttpClient);

  listarVeiculos(): Observable<Veiculo[]> {
    return this.http.get<Veiculo[]>(`${API}/veiculos`);
  }

  telemetriaAtual(veiculoId: number): Observable<TelemetriaAtual> {
    return this.http.get<TelemetriaAtual>(`${API}/telemetria/atual/${veiculoId}`);
  }

  resumoFrota(): Observable<ResumoFrota> {
    return this.http.get<ResumoFrota>(`${API}/veiculos/resumo`);
  }

  statusSimulacao(): Observable<StatusSimulacao> {
    return this.http.get<StatusSimulacao>(`${API}/simulacao/status`);
  }

  // [HISTÓRICO] Busca os últimos alertas registrados para o veículo
  listarAlertas(veiculoId: number, limit = 20): Observable<AlertaHistorico[]> {
    return this.http.get<AlertaHistorico[]>(
      `${API}/veiculos/${veiculoId}/alertas`,
      { params: { limit: String(limit) } },
    );
  }
}