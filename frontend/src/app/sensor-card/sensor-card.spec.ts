import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SensorCard } from './sensor-card';

describe('SensorCard', () => {
  let component: SensorCard;
  let fixture: ComponentFixture<SensorCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SensorCard],
    }).compileComponents();

    fixture = TestBed.createComponent(SensorCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
