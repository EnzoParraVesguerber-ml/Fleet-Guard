import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class Header implements OnInit, OnDestroy {
  vehicleId = 'Ônibus 0412';
  vehiclePlate = 'FGX-4A21';
  fleetOnline = 0;
  fleetTotal = 0;
  alertCount = 0;

  private poll?: any;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.fetchResumo();
    this.poll = setInterval(() => this.fetchResumo(), 5000);
  }

  ngOnDestroy() {
    if (this.poll) clearInterval(this.poll);
  }

  private fetchResumo() {
    this.http.get<any>('http://127.0.0.1:5000/api/veiculos/resumo').subscribe({
      next: (d) => {
        this.fleetTotal  = d.total;
        this.fleetOnline = d.operando_normal;
        this.alertCount  = d.em_alerta;
        this.cdr.detectChanges();   // 🔥 ADICIONE
      },
      error: (e) => console.error('Falha ao buscar resumo da frota:', e)
    });
  }
}