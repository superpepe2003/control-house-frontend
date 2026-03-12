import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../auth/services/auth.service';

interface NavCard {
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
  available: boolean;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly navCards: NavCard[] = [
    {
      title: 'Cuentas',
      description: 'Administrá tus cuentas bancarias, efectivo y tarjetas. Visualizá balances y movimientos.',
      icon: 'account_balance_wallet',
      route: '/accounts',
      color: 'card-accounts',
      available: true,
    },
    {
      title: 'Categorías',
      description: 'Organizá tus ingresos y gastos por categorías personalizadas para un mejor control.',
      icon: 'label',
      route: '/categories',
      color: 'card-categories',
      available: false,
    },
    {
      title: 'Transacciones',
      description: 'Registrá y consultá el historial completo de tus movimientos financieros.',
      icon: 'receipt_long',
      route: '/transactions',
      color: 'card-transactions',
      available: false,
    },
  ];

  navigate(card: NavCard): void {
    if (card.available) {
      this.router.navigate([card.route]);
    }
  }

  logout(): void {
    this.authService.logout();
  }
}
