import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FrotaState {
  /** ID do veículo selecionado no <select> da sidebar */
  veiculoSelecionado = signal<number | null>(null);

  /** Indica se a simulação está rodando no backend */
  simulacaoAtiva = signal<boolean>(false);

  selecionar(id: number) {
    this.veiculoSelecionado.set(id);
  }
}