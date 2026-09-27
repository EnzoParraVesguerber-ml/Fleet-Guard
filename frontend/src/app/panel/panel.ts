import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Container base do dashboard (borda + sombra + cabeçalho).
 *
 * Uso:
 *   <app-panel heading="Consumo de combustível" subtitle="últimas 24h">
 *     <span panel-actions>...</span>   <!-- opcional, canto direito do cabeçalho -->
 *     ...conteúdo...
 *   </app-panel>
 *
 * Sem conteúdo pronto ainda? Passe `placeholder` e o painel mostra um estado vazio:
 *   <app-panel heading="Mapa da rota" placeholder="Em desenvolvimento"></app-panel>
 */
@Component({
  selector: 'app-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './panel.html',
  styleUrl: './panel.css'
})
export class Panel {
  @Input() heading = '';
  @Input() subtitle = '';
  /** Texto do estado vazio. Se definido, substitui o conteúdo projetado. */
  @Input() placeholder = '';
  /** Remove o padding do corpo (útil para listas que vão de borda a borda). */
  @Input() flush = false;
}
