import { Routes } from '@angular/router';

export const accountsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/accounts/accounts.component').then((m) => m.AccountsComponent),
  },
];
