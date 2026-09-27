/** Nível de severidade usado em todo o dashboard (cards, painéis, alertas). */
export type Status = 'ok' | 'warn' | 'crit';

/** Leitura de um sensor exibida num <app-sensor-card>. */
export interface SensorReading {
  /** Chave do campo no dataset, ex: "temp_motor_spn110" */
  key: string;
  name: string;
  unit: string;
  value: string;
  status: Status;
  statusText: string;
  /** Histórico (mais antiga -> mais recente) */
  history: number[];
}

/** Linha de um painel de status (motor / freios). */
export interface StatusItem {
  label: string;
  detail: string;
  status: Status;
}

/** Saída do modelo de classificação de falhas. */
export interface Prediction {
  /** Rótulo previsto: "Operação Normal" | "Alerta: Falha Iminente" */
  label: string;
  /** Probabilidade da classe "falha", 0..1 */
  failureProbability: number;
  model: string;
  updatedAt: string;
}

export const STATUS_WEIGHT: Record<Status, number> = { ok: 0, warn: 1, crit: 2 };

export const STATUS_LABEL: Record<Status, string> = {
  ok: 'Normal',
  warn: 'Atenção',
  crit: 'Crítico'
};

/** Retorna o status mais grave de uma lista. */
export function worstStatus(list: Status[]): Status {
  return list.reduce<Status>(
    (acc, s) => (STATUS_WEIGHT[s] > STATUS_WEIGHT[acc] ? s : acc),
    'ok'
  );
}
