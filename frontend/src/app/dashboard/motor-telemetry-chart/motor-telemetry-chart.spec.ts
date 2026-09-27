import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MotorTelemetryChart } from './motor-telemetry-chart';

describe('MotorTelemetryChart', () => {
  let component: MotorTelemetryChart;
  let fixture: ComponentFixture<MotorTelemetryChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MotorTelemetryChart],
    }).compileComponents();

    fixture = TestBed.createComponent(MotorTelemetryChart);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
