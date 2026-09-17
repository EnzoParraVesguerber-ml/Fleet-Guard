import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class Header {
  vehicleId = 'Ônibus 0412';
  vehiclePlate = 'FGX-4A21';
  fleetOnline = 41;
  fleetTotal = 44;
  alertCount = 3;
}