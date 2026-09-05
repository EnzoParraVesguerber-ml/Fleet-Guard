import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SensorCard } from '../sensor-card/sensor-card';

interface Alert {
  title: string;
  meta: string;
  time: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, SensorCard],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard {
  // TODO: substituir os arrays de histórico pelas leituras reais vindas da API/websocket

  engineTemp = {
    value: '104',
    status: 'warn' as const,
    statusText: 'Acima do normal (limite: 98°C)',
    history: [88, 90, 91, 93, 95, 97, 99, 101, 103, 104]
  };

  rpm = {
    value: '1 850',
    status: 'ok' as const,
    statusText: 'Dentro da faixa esperada',
    history: [1620, 1700, 1750, 1680, 1800, 1820, 1790, 1850, 1830, 1850]
  };

  oilPressure = {
    value: '42',
    status: 'ok' as const,
    statusText: 'Dentro da faixa esperada',
    history: [40, 41, 39, 42, 43, 41, 40, 42, 41, 42]
  };

  vibration = {
    value: '2.1',
    status: 'ok' as const,
    statusText: 'Dentro da faixa esperada',
    history: [1.8, 1.9, 2.0, 1.9, 2.2, 2.0, 1.9, 2.1, 2.0, 2.1]
  };

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
}