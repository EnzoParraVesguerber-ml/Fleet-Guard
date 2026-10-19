import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dashboard } from './dashboard';
import { TelemetriaService } from '../services/telemetria.service';
import { FrotaState } from '../services/frota-state';
import { of } from 'rxjs';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      // [INTEGRAÇÃO - TESTE] Resposta controlada para testar sem depender do Flask ou banco.
      providers: [{ provide: TelemetriaService, useValue: {
        telemetriaAtual: () => of({
          temp_motor: 89.5, rpm: 1500, pressao_oleo: 300, vibracao: 0.05,
          velocidade_kmh_spn84: 45.2, alerta_preditivo: 'Operação Normal',
          timestamp: 120.5, prob_falha: null,
        }),
      } }],
    }).overrideComponent(Dashboard, {
      set: { imports: [], template: '{{ dadosTelemetria()?.temp_motor }}' },
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // [INTEGRAÇÃO - TESTE] Regressão: verifica armazenamento, histórico e interpolação
  // da primeira resposta, sem precisar iniciar a simulação.
  it('exibe a primeira leitura do banco sem iniciar uma simulação', async () => {
    TestBed.inject(FrotaState).selecionar(0);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.dadosTelemetria()?.temp_motor).toBe(89.5);
    expect(component.hist().temp).toEqual([89.5]);
    expect(fixture.nativeElement.textContent).toContain('89.5');
    fixture.destroy();
  });
});
