"""
FleetGuard - Gerador de Dados Telemétricos Sintéticos (Mock)
==============================================================

Simula a operação de um autocarro urbano pesado, gerando uma série temporal
fisicamente coerente para treino de modelos de manutenção preditiva
(Regressão Logística / Random Forest).

Princípios implementados (conforme especificação do projeto):
  1. Máquina de estados de condução: IDLE -> ACCEL -> CRUISE -> BRAKE
  2. Inércia térmica acoplada (EDO de balanço de energia, integrada por Euler)
  3. Proteção do sistema (Derate) em caso de superaquecimento
  4. Ruído gaussiano de sensor em todos os canais
  5. Injeção opcional de falhas (drift lento) para rotulagem supervisionada

Colunas de saída:
  timestamp, velocidade_kmh_spn84, rpm_spn190, carga_motor_spn92,
  temp_motor_spn110, pressao_oleo_spn100, vibracao_freio,
  temp_cubo_roda_ir, target
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass
from enum import Enum


# ----------------------------------------------------------------------
# 1. Máquina de estados de condução
# ----------------------------------------------------------------------

class EstadoCondução(Enum):
    IDLE = "marcha_lenta"
    ACCEL = "aceleracao"
    CRUISE = "cruzeiro"
    BRAKE = "frenagem"


# Matriz de transição (Cadeia de Markov) — representa um ciclo urbano típico
# "para e arranca": da marcha lenta tende a acelerar; do cruzeiro tende a
# frear (semáforo/parada); dificilmente salta IDLE -> CRUISE diretamente.
MATRIZ_TRANSICAO = {
    EstadoCondução.IDLE:   {EstadoCondução.IDLE: 0.55, EstadoCondução.ACCEL: 0.45},
    EstadoCondução.ACCEL:  {EstadoCondução.ACCEL: 0.55, EstadoCondução.CRUISE: 0.45},
    EstadoCondução.CRUISE: {EstadoCondução.CRUISE: 0.85, EstadoCondução.BRAKE: 0.15},
    EstadoCondução.BRAKE:  {EstadoCondução.BRAKE: 0.35, EstadoCondução.IDLE: 0.65},
}

# RPM-alvo (aprox.) e carga de motor típica por estado
RPM_ALVO = {
    EstadoCondução.IDLE:   700,
    EstadoCondução.ACCEL:  1900,
    EstadoCondução.CRUISE: 1500,
    EstadoCondução.BRAKE:  650,
}
CARGA_ALVO_PCT = {
    EstadoCondução.IDLE:   5,
    EstadoCondução.ACCEL:  80,
    EstadoCondução.CRUISE: 45,
    EstadoCondução.BRAKE:  2,
}


def proximo_estado(estado_atual: EstadoCondução, rng: np.random.Generator) -> EstadoCondução:
    """Sorteia o próximo estado a partir da matriz de transição de Markov."""
    opcoes = MATRIZ_TRANSICAO[estado_atual]
    estados, probs = zip(*opcoes.items())
    return rng.choice(estados, p=probs)


# ----------------------------------------------------------------------
# 2. Parâmetros físicos do modelo
# ----------------------------------------------------------------------

@dataclass
class ParametrosFisicos:
    # --- Térmicos (motor) ---
    # Constantes calibradas empiricamente para que o regime de cruzeiro
    # convirja para ~88-90 °C (setpoint do termostato) com tau ~ algumas
    # centenas de segundos, coerente com a inércia térmica real do bloco.
    massa_termica_equiv: float = 3000.0  # ~ m*cp agregado (bloco + fluido)
    temp_ambiente: float = 28.0          # °C
    ua_base: float = 8.0                 # coef. de troca térmica com termostato fechado
    ua_max: float = 30.0                 # coef. com termostato + ventoinha atuando
    setpoint_termostato: float = 88.0    # °C — abertura do termostato
    ganho_calor_combustao: float = 62.0  # converte (rpm_norm * carga) em Q_comb

    # --- Proteção / Derate ---
    temp_derate_ativa: float = 108.0     # °C — ECU começa a cortar potência
    temp_derate_total: float = 118.0     # °C — corte severo (parada forçada)

    # --- Óleo ---
    pressao_oleo_max: float = 620.0      # kPa, saturação em alto RPM
    beta_temp_oleo: float = 2.1          # queda de pressão por °C acima do setpoint

    # --- Ruído de sensor (gaussiano) ---
    ruido_rpm: float = 12.0
    ruido_temp: float = 0.5
    ruido_pressao: float = 8.0
    ruido_carga: float = 2.0
    ruido_velocidade: float = 0.6

    # --- Freio / roda (baseline saudável) ---
    temp_cubo_ambiente: float = 32.0
    ruido_temp_cubo: float = 0.8
    vibracao_base_rms: float = 0.05      # "g" RMS, ruído branco saudável


# ----------------------------------------------------------------------
# 3. Injeção de falhas
# ----------------------------------------------------------------------

class TipoFalha(Enum):
    NENHUMA = "nenhuma"
    SUPERAQUECIMENTO = "superaquecimento"          # falha na bomba d'água / radiador
    FREIO_PINCA_PRESA = "freio_pinca_presa"          # atrito residual constante
    ROLAMENTO_DESGASTE = "rolamento_desgaste"        # vibração de alta frequência crescente


@dataclass
class ConfigFalha:
    tipo: TipoFalha = TipoFalha.NENHUMA
    t_inicio_s: float = 0.0       # instante em que o drift começa a se manifestar
    severidade_final: float = 1.0  # 0-1, intensidade no fim da simulação


# ----------------------------------------------------------------------
# 4. Simulador principal
# ----------------------------------------------------------------------

class SimuladorFleetGuard:
    def __init__(
        self,
        duracao_s: int = 3600,
        dt_s: float = 1.0,
        params: ParametrosFisicos | None = None,
        falha: ConfigFalha | None = None,
        seed: int | None = None,
    ):
        self.duracao_s = duracao_s
        self.dt = dt_s
        self.p = params or ParametrosFisicos()
        self.falha = falha or ConfigFalha()
        self.rng = np.random.default_rng(seed)

        # Estado interno (persiste entre passos — cria a inércia/atraso real)
        self.estado = EstadoCondução.IDLE
        self.rpm = 700.0
        self.velocidade = 0.0
        self.carga = 5.0
        self.temp_motor = self.p.temp_ambiente
        self.temp_cubo_roda = self.p.temp_cubo_ambiente
        self.derate_ativo = False
        self.tensao_bateria = 28.2

    # -- funções auxiliares de física -----------------------------------

    def _ua_efetivo(self, temp_motor: float) -> float:
        """UA como sigmoide dependente da temperatura (abertura do termostato)."""
        x = (temp_motor - self.p.setpoint_termostato) / 3.0
        sigmoide = 1.0 / (1.0 + np.exp(-x))
        return self.p.ua_base + sigmoide * (self.p.ua_max - self.p.ua_base)

    def _severidade_falha(self, t: float) -> float:
        """Rampa de 0 -> severidade_final a partir de t_inicio_s (drift contínuo)."""
        if self.falha.tipo == TipoFalha.NENHUMA or t < self.falha.t_inicio_s:
            return 0.0
        duracao_rampa = max(self.duracao_s - self.falha.t_inicio_s, 1.0)
        progresso = (t - self.falha.t_inicio_s) / duracao_rampa
        return float(np.clip(progresso, 0.0, 1.0)) * self.falha.severidade_final

    def _passo_condução(self):
        """Atualiza estado de condução, RPM-alvo e velocidade (1ª ordem, suavizado)."""
        self.estado = proximo_estado(self.estado, self.rng)
        rpm_alvo = RPM_ALVO[self.estado] + self.rng.normal(0, 40)
        carga_alvo = CARGA_ALVO_PCT[self.estado] + self.rng.normal(0, 5)

        # Derate: ECU virtual limita RPM/carga se temperatura crítica
        if self.temp_motor >= self.p.temp_derate_total:
            rpm_alvo = min(rpm_alvo, 550)
            carga_alvo = min(carga_alvo, 3)
        elif self.temp_motor >= self.p.temp_derate_ativa:
            fator_corte = 1.0 - 0.6 * (
                (self.temp_motor - self.p.temp_derate_ativa)
                / (self.p.temp_derate_total - self.p.temp_derate_ativa)
            )
            rpm_alvo *= max(fator_corte, 0.4)
            carga_alvo *= max(fator_corte, 0.4)
            self.derate_ativo = True
        else:
            self.derate_ativo = False

        # Suavização (1ª ordem) — RPM/velocidade não saltam instantaneamente
        alpha = 0.25
        self.rpm += alpha * (rpm_alvo - self.rpm)
        self.carga += alpha * (carga_alvo - self.carga)

        vel_alvo = {
            EstadoCondução.IDLE: 0.0,
            EstadoCondução.ACCEL: min(60.0, self.velocidade + 8.0),
            EstadoCondução.CRUISE: self.rng.normal(45, 4),
            EstadoCondução.BRAKE: max(0.0, self.velocidade - 10.0),
        }[self.estado]
        self.velocidade += 0.35 * (vel_alvo - self.velocidade)
        self.velocidade = max(self.velocidade, 0.0)

    def _passo_termico(self, t: float, sev_superaquecimento: float):
        """Integra a EDO de balanço térmico por Euler explícito."""
        rpm_norm = self.rpm / 2200.0
        q_comb = self.p.ganho_calor_combustao * rpm_norm * max(self.carga, 0)

        ua = self._ua_efetivo(self.temp_motor)
        # Falha de superaquecimento = supressão sustentada de UA (bomba/radiador degradado)
        ua *= (1.0 - 0.75 * sev_superaquecimento)

        dT = (q_comb - ua * (self.temp_motor - self.p.temp_ambiente)) / self.p.massa_termica_equiv
        self.temp_motor += dT * self.dt
        self.temp_motor = max(self.temp_motor, self.p.temp_ambiente)

    def _pressao_oleo(self) -> float:
        """Sobe com RPM (saturação), cai com temperatura do óleo (~ temp motor)."""
        base = self.p.pressao_oleo_max * (1 - np.exp(-self.rpm / 900.0))
        queda_termica = self.p.beta_temp_oleo * max(self.temp_motor - self.p.setpoint_termostato, 0)
        return max(base - queda_termica, 30.0)

    def _sensores_roda(self, sev_freio: float, sev_rolamento: float):
        """Temperatura do cubo (IR) e vibração — assinaturas de falha mecânica."""
        # Baseline saudável: aquece um pouco durante frenagens reais, dissipa em repouso
        if self.estado == EstadoCondução.BRAKE:
            self.temp_cubo_roda += 0.4
        else:
            self.temp_cubo_roda -= 0.15 * (self.temp_cubo_roda - self.p.temp_cubo_ambiente)

        # Falha de pinça presa: fonte de calor parasita constante enquanto o veículo se move
        # (curva parabólica de elevação, sem tempo de arrefecimento convectivo)
        if sev_freio > 0 and self.velocidade > 0:
            self.temp_cubo_roda += sev_freio * (2.2 + 0.03 * self.temp_cubo_roda)

        # Vibração: ruído branco saudável -> ruído rosa/browniano crescente (desgaste de rolamento)
        ruido_branco = self.rng.normal(0, self.p.vibracao_base_rms)
        if sev_rolamento > 0:
            # aproxima ruído rosa por integração de ruído branco (passeio aleatório amortecido)
            self._acumulador_rosa = getattr(self, "_acumulador_rosa", 0.0)
            self._acumulador_rosa = 0.97 * self._acumulador_rosa + self.rng.normal(0, 1)
            componente_rosa = sev_rolamento * 0.35 * self._acumulador_rosa
            # fator de crista sobe primeiro (picos esporádicos) antes da energia RMS global
            pico_esporadico = sev_rolamento * self.rng.normal(0, 0.6) if self.rng.random() < 0.08 else 0.0
            vibracao = abs(ruido_branco + componente_rosa + pico_esporadico)
        else:
            vibracao = abs(ruido_branco)

        return self.temp_cubo_roda, vibracao

    # -- laço principal ---------------------------------------------------

    def _sistemas_auxiliares(self):
        """Simula falhas não mecânicas para compor o histórico no banco de dados."""
        # Portas operam apenas quando o ônibus está parado
        if self.estado == EstadoCondução.IDLE and self.velocidade < 1.0:
            status_porta = "aberta"
            falha_porta = self.rng.random() < 0.015 # 1.5% de chance de travamento elétrico
        else:
            status_porta = "fechada"
            falha_porta = False

        self.tensao_bateria = 28.2 + self.rng.normal(0, 0.2)
        if falha_porta:
            self.tensao_bateria -= self.rng.uniform(1.5, 3.5) # Queda de tensão por esforço do motor da porta
            codigo_scanner = "ERR_PORTA_ATUADOR"
        elif self.rng.random() < 0.005:
            codigo_scanner = "CAN_TIMEOUT_WARN"
        else:
            codigo_scanner = "OK"

        return status_porta, round(self.tensao_bateria, 1), codigo_scanner
    
    def gerar(self) -> pd.DataFrame:
        n_passos = int(self.duracao_s / self.dt)
        registros = []

        for i in range(n_passos):
            t = i * self.dt
            sev = self._severidade_falha(t)
            sev_super = sev if self.falha.tipo == TipoFalha.SUPERAQUECIMENTO else 0.0
            sev_freio = sev if self.falha.tipo == TipoFalha.FREIO_PINCA_PRESA else 0.0
            sev_rolam = sev if self.falha.tipo == TipoFalha.ROLAMENTO_DESGASTE else 0.0

            self._passo_condução()
            self._passo_termico(t, sev_super)
            pressao = self._pressao_oleo()
            temp_cubo, vibracao = self._sensores_roda(sev_freio, sev_rolam)
            
            # --- NOVO: Chamada dos sistemas auxiliares ---
            status_porta, tensao, codigo_scanner = self._sistemas_auxiliares()

            # Rótulo: "Alerta: Falha Iminente" quando a severidade já é perceptível (>15%)
            target = "Operação Normal" if sev < 0.15 else "Alerta: Falha Iminente"

            registros.append({
                "timestamp": t,
                "velocidade_kmh_spn84": round(self.velocidade + self.rng.normal(0, self.p.ruido_velocidade), 2),
                "rpm_spn190": round(max(self.rpm + self.rng.normal(0, self.p.ruido_rpm), 0), 1),
                "carga_motor_spn92": round(np.clip(self.carga + self.rng.normal(0, self.p.ruido_carga), 0, 100), 1),
                "temp_motor_spn110": round(self.temp_motor + self.rng.normal(0, self.p.ruido_temp), 2),
                "pressao_oleo_spn100": round(pressao + self.rng.normal(0, self.p.ruido_pressao), 1),
                "vibracao_freio": round(vibracao, 4),
                "temp_cubo_roda_ir": round(temp_cubo + self.rng.normal(0, self.p.ruido_temp_cubo), 2),
                "status_porta": status_porta,
                "tensao_bateria_v": tensao,
                "codigo_erro_scanner": codigo_scanner,
                "target": target,
            })

        return pd.DataFrame.from_records(registros)


# ----------------------------------------------------------------------
# 5. Geração de um dataset completo (vários veículos / cenários)
# ----------------------------------------------------------------------

def gerar_dataset_frota(
    n_veiculos_normais: int = 6,
    n_por_falha: int = 2,
    duracao_s: int = 3600,
    seed_base: int = 42,
) -> pd.DataFrame:
    """Combina várias simulações (normais + cada tipo de falha) num único dataset,
    identificando cada corrida por veiculo_id — pronto para treino supervisionado."""
    partes = []
    veiculo_id = 0

    # Cenários saudáveis
    for _ in range(n_veiculos_normais):
        sim = SimuladorFleetGuard(duracao_s=duracao_s, falha=ConfigFalha(TipoFalha.NENHUMA), seed=seed_base + veiculo_id)
        df = sim.gerar()
        df.insert(0, "veiculo_id", veiculo_id)
        partes.append(df)
        veiculo_id += 1

    # Cenários com falha (drift começa em ~40% da simulação)
    for tipo in [TipoFalha.SUPERAQUECIMENTO, TipoFalha.FREIO_PINCA_PRESA, TipoFalha.ROLAMENTO_DESGASTE]:
        for _ in range(n_por_falha):
            falha_cfg = ConfigFalha(tipo=tipo, t_inicio_s=duracao_s * 0.4, severidade_final=1.0)
            sim = SimuladorFleetGuard(duracao_s=duracao_s, falha=falha_cfg, seed=seed_base + veiculo_id)
            df = sim.gerar()
            df.insert(0, "veiculo_id", veiculo_id)
            partes.append(df)
            veiculo_id += 1

    return pd.concat(partes, ignore_index=True)


import os

if __name__ == "__main__":
    # Parâmetros ajustados para 8 horas de simulação
    dataset = gerar_dataset_frota(n_veiculos_normais=20, n_por_falha=4, duracao_s=28800)
    
    # Descobre o caminho absoluto da pasta onde o script está rodando (.../edge_simulation/generators)
    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    
    # Sobe um nível e aponta para uma nova pasta chamada 'data' (.../edge_simulation/data)
    diretorio_saida = os.path.join(os.path.dirname(diretorio_atual), "data")
    
    # Cria a pasta 'data' automaticamente caso ela não exista
    os.makedirs(diretorio_saida, exist_ok=True)
    
    # Define o caminho final do arquivo CSV
    caminho_arquivo = os.path.join(diretorio_saida, "fleetguard_dataset_mock.csv")
    
    # Salva o arquivo no local designado
    dataset.to_csv(caminho_arquivo, index=False)

    print(f"Dataset salvo com sucesso em: {caminho_arquivo}")
    print(f"Total: {len(dataset)} amostras, {dataset['veiculo_id'].nunique()} corridas de veículo.")
