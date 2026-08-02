import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from './components/sidebar/sidebar';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    Sidebar
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '[class.sidebar-open]': 'sidebarOpen()',
  },
})
export class App {
  sidebarOpen = signal(false);

  toggleSidebar() {
    this.sidebarOpen.update(v => !v);
  }

  closeSidebar() {
    this.sidebarOpen.set(false);
  }
}