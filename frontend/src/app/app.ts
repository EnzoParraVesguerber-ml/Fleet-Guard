import { Component, signal } from '@angular/core';
import { Sidebar } from './sidebar/sidebar';
import { Header } from './header/header';
import { Dashboard } from './dashboard/dashboard';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [Sidebar, Header, RouterOutlet], // RouterOutlet removido da array
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('fleetguard-web');
}