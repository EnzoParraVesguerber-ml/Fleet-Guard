import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// [INTEGRAÇÃO - ITEM 3] URL local do Flask já existente, mantida nesta integração.
const API = 'http://127.0.0.1:5000/api';

export interface TelemetriaAtual {
  temp_motor: number;
  rpm: number;
  pressao_oleo: number;
  vibracao: number;
  velocidade_kmh_spn84: number;
  alerta_preditivo: string;
  timestamp: number;
  prob_falha: number | null;   // ← NOVO
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

// [INTEGRAÇÃO - ITEM 2] Arquivo renomeado de telemetria.ts para telemetria.service.ts.
// As consultas GET foram mantidas aqui; os comandos POST foram movidos para SimulacaoService.
@Injectable({ providedIn: 'root' })
export class TelemetriaService {
  private http = inject(HttpClient);

  listarVeiculos(): Observable<Veiculo[]> {
    return this.http.get<Veiculo[]>(`${API}/veiculos`);
  }

  telemetriaAtual(veiculoId: number): Observable<TelemetriaAtual> {
    // [INTEGRAÇÃO - ITEM 3] Rota GET existente para a última leitura de um veículo.
    // /api/telemetria, sem /atual/<id>, é a rota POST de recebimento de dados.
    return this.http.get<TelemetriaAtual>(`${API}/telemetria/atual/${veiculoId}`);
  }

  resumoFrota(): Observable<ResumoFrota> {
    return this.http.get<ResumoFrota>(`${API}/veiculos/resumo`);
  }

  statusSimulacao(): Observable<StatusSimulacao> {
    return this.http.get<StatusSimulacao>(`${API}/simulacao/status`);
  }
}
