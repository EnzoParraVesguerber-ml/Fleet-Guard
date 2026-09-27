import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Panel } from '../panel/panel';
import { Status, StatusItem, STATUS_LABEL, worstStatus } from '../models/telemetry';

/**
 * Painel de status de um subsistema (motor, freios...).
 * O selo do cabeçalho mostra automaticamente o status mais grave entre os itens.
 */
@Component({
  selector: 'app-status-panel',
  standalone: true,
  imports: [CommonModule, Panel],
  templateUrl: './status-panel.html',
  styleUrl: './status-panel.css'
})
export class StatusPanel {
  @Input() heading = '';
  @Input() subtitle = '';
  @Input() items: StatusItem[] = [];

  get overall(): Status {
    return worstStatus(this.items.map(i => i.status));
  }

  get overallLabel(): string {
    return STATUS_LABEL[this.overall];
  }
}
