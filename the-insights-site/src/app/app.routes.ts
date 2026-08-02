import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { BestLineup } from './pages/best-lineup/best-lineup';
import { InDepthRole } from './pages/in-depth-role/in-depth-role';
import { Simulator } from './pages/simulator/simulator';
import { Leaderboard } from './pages/leaderboard/leaderboard';
import { Prophecy } from './pages/prophecy/prophecy';

export const routes: Routes = [
  {
    path: '',
    component: Home
  },
  {
    path: 'best-lineup',
    component: BestLineup
  },
  {
    path: 'in-depth-role',
    component: InDepthRole
  },
  {
    path: 'in-depth-role/:name',
    component: InDepthRole
  },
  {
    path: 'simulator',
    component: Simulator
  },
  {
    path: 'leaderboard',
    component: Leaderboard
  },
  {
    path: 'prophecy',
    component: Prophecy
  },
  {
    path: '**',
    redirectTo: ''
  }
];