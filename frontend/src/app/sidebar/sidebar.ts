import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class Sidebar {
  navItems = [
    { label: 'Dashboard', active: true },
    { label: 'Veículos', active: false },
    { label: 'Histórico', active: false }
  ];
}