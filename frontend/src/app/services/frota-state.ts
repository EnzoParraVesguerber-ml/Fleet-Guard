import { Injectable, signal, computed } from '@angular/core';

export type TipoFalha = 'normal' | 'motor' | 'freio' | 'rolamento';

/** Texto amigável por tipo de falha (usado em alertas e painel) */
export const TIPO_FALHA_DESC: Record<TipoFalha, string> = {
  normal:    'Operação normal',
  motor:     'Superaquecimento do motor',
  freio:     'Pinça de freio presa',
  rolamento: 'Desgaste de rolamento',
};

@Injectable({ providedIn: 'root' })
export class FrotaState {
  /** ID do veículo selecionado no <select> da sidebar */
  veiculoSelecionado = signal<number | null>(null);

  /** Tipo de falha do veículo atualmente selecionado */
  tipoFalhaAtual = signal<TipoFalha>('normal');

  /** Descrição amigável do tipo de falha atual */
  tipoFalhaDescricao = computed(() => TIPO_FALHA_DESC[this.tipoFalhaAtual()]);

  /** Indica se a simulação está rodando no backend */
  simulacaoAtiva = signal<boolean>(false);

  selecionar(id: number, tipoFalha?: TipoFalha) {
    this.veiculoSelecionado.set(id);
    if (tipoFalha) this.tipoFalhaAtual.set(tipoFalha);
  }
}