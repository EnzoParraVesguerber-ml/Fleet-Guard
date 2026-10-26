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
      providers: [{ provide: TelemetriaService, useValue: {
        telemetriaAtual: () => of({
          temp_motor: 89.5, rpm: 1500, pressao_oleo: 300, vibracao: 0.05,
          velocidade_kmh_spn84: 45.2, alerta_preditivo: 'Operação Normal',
          timestamp: 120.5, prob_falha: null,
        }),
        listarAlertas: () => of([]),
      } }],
    }).overrideComponent(Dashboard, {
      // Mostra o valor do 1º card (temp) — o histórico do gráfico agora começa vazio.
      set: { imports: [], template: '{{ engineSensors()[0]?.value }}' },
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('primeira leitura popula os cards mas NÃO o histórico do gráfico', async () => {
    TestBed.inject(FrotaState).selecionar(0);
    fixture.detectChanges();
    await fixture.whenStable();

    // Cards mostram o valor histórico…
    expect(component.engineSensors().length).toBeGreaterThan(0);
    expect(component.engineSensors()[0].value).toBe('89.5');
    expect(fixture.nativeElement.textContent).toContain('89.5');

    // …mas o histórico do gráfico começa vazio (sem "lixo" inicial).
    expect(component.hist().temp).toEqual([]);
    expect(component.hist().rpm).toEqual([]);

    fixture.destroy();
  });
});