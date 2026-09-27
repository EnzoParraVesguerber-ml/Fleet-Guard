import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SensorCard } from '../sensor-card/sensor-card';
import { Panel } from '../panel/panel';
import { StatusPanel } from '../status-panel/status-panel';
import { PredictionPanel } from '../prediction-panel/prediction-panel';
import { Prediction, SensorReading, StatusItem } from '../models/telemetry';

interface Alert {
  title: string;
  meta: string;
  time: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, SensorCard, Panel, StatusPanel, PredictionPanel],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard {
  // TODO: substituir os mocks abaixo pelas leituras reais vindas da API/websocket.
  // As chaves (key) seguem os campos do dataset do gerador (SPNs SAE J1939).

  /** Sensores do motor — renderizados na linha "Motor" (4 por linha) */
  engineSensors: SensorReading[] = [
    {
      key: 'temp_motor_spn110',
      name: 'Temperatura do motor',
      unit: '°C',
      value: '104',
      status: 'warn',
      statusText: 'Acima do normal (limite: 98°C)',
      history: [88, 90, 91, 93, 95, 97, 99, 101, 103, 104]
    },
    {
      key: 'rpm_spn190',
      name: 'Rotação do motor',
      unit: 'rpm',
      value: '1 850',
      status: 'ok',
      statusText: 'Dentro da faixa esperada',
      history: [1620, 1700, 1750, 1680, 1800, 1820, 1790, 1850, 1830, 1850]
    },
    {
      key: 'pressao_oleo_spn100',
      name: 'Pressão do óleo',
      unit: 'psi',
      value: '42',
      status: 'ok',
      statusText: 'Dentro da faixa esperada',
      history: [40, 41, 39, 42, 43, 41, 40, 42, 41, 42]
    },
    {
      key: 'carga_motor_spn92',
      name: 'Carga do motor',
      unit: '%',
      value: '68',
      status: 'ok',
      statusText: 'Dentro da faixa esperada',
      history: [55, 58, 62, 60, 65, 70, 66, 68, 67, 68]
    }
  ];

  /** Sensores de freio e rodagem — renderizados na linha "Freios e rodagem" (3 por linha) */
  brakeSensors: SensorReading[] = [
    {
      key: 'vibracao_freio',
      name: 'Vibração do freio',
      unit: 'mm/s',
      value: '2.1',
      status: 'ok',
      statusText: 'Dentro da faixa esperada',
      history: [1.8, 1.9, 2.0, 1.9, 2.2, 2.0, 1.9, 2.1, 2.0, 2.1]
    },
    {
      key: 'temp_cubo_roda_ir',
      name: 'Temp. do cubo de roda (IR)',
      unit: '°C',
      value: '71',
      status: 'ok',
      statusText: 'Dentro da faixa esperada',
      history: [60, 62, 63, 65, 66, 68, 69, 70, 70, 71]
    },
    {
      key: 'velocidade_kmh_spn84',
      name: 'Velocidade',
      unit: 'km/h',
      value: '42',
      status: 'ok',
      statusText: 'Em cruzeiro',
      history: [30, 35, 38, 40, 44, 46, 41, 39, 43, 42]
    }
  ];

  /** Saída do modelo. Deixe `null` para exibir o estado vazio do painel. */
  prediction: Prediction | null = {
    label: 'Operação Normal',
    failureProbability: 0.34,
    model: 'Random Forest · janela de 10 min',
    updatedAt: 'há 12 s'
  };

  motorStatus: StatusItem[] = [
    { label: 'Temperatura', detail: '104 °C / 98 °C', status: 'warn' },
    { label: 'Pressão do óleo', detail: '42 psi', status: 'ok' },
    { label: 'Rotação', detail: '1 850 rpm', status: 'ok' },
    { label: 'Derate de proteção', detail: 'inativo', status: 'ok' }
  ];

  brakeStatus: StatusItem[] = [
    { label: 'Vibração do freio', detail: '2.1 mm/s', status: 'ok' },
    { label: 'Temp. cubo de roda', detail: '71 °C', status: 'ok' },
    { label: 'Última revisão', detail: 'há 38 dias', status: 'ok' }
  ];

  alerts: Alert[] = [
    {
      title: 'Superaquecimento — Ônibus 0412',
      meta: 'Temperatura do motor 6°C acima do limite seguro',
      time: 'há 4 min'
    },
    {
      title: 'Desgaste de freio — Ônibus 0288',
      meta: 'Padrão de vibração sugere revisão do sistema de freios',
      time: 'há 27 min'
    },
    {
      title: 'Pressão de óleo instável — Ônibus 0193',
      meta: 'Variação fora do padrão nas últimas 2 horas',
      time: 'há 1h 12min'
    }
  ];

  trackByKey(_: number, s: SensorReading): string {
    return s.key;
  }
}
