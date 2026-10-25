import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API = 'http://127.0.0.1:5000/api';

// [INTEGRAÇÃO - ITEM 2] Novo serviço: recebe os comandos POST antes presentes
// em TelemetriaService, permitindo que o serviço de consultas contenha apenas GET.
@Injectable({ providedIn: 'root' })
export class SimulacaoService {
  private http = inject(HttpClient);

  iniciarSimulacao(veiculoId: number, intervalo_s = 1.0) {
    return this.http.post<{ status: string; veiculo_id: number }>(`${API}/simulacao/iniciar`, {
      veiculo_id: veiculoId,
      intervalo_s,
    });
  }

  pararSimulacao() {
    return this.http.post<{ status: string }>(`${API}/simulacao/parar`, {});
  }
}
