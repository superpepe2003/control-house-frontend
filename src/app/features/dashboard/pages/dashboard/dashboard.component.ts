import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { AuthService } from '../../../auth/services/auth.service';
import { DashboardService } from '../../services/dashboard.service';
import { DashboardSummary } from '../../models/dashboard.models';
import { Transaction } from '../../../transactions/models/transaction.models';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    CurrencyPipe,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTableModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSidenavModule,
    MatListModule,
    MatDividerModule,
    BaseChartDirective,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly recentTransactions = signal<Transaction[]>([]);

  readonly displayedColumns = ['date', 'description', 'category', 'type', 'amount'];

  // Datos de Chart.js como propiedades simples (no signals) para compatibilidad con OnPush
  barChartData: ChartData<'bar'> = { labels: [], datasets: [] };
  pieChartData: ChartData<'pie'> = { labels: [], datasets: [] };

  readonly barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          label: (ctx) =>
            ` $${Number(ctx.raw).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (v) => `$${Number(v).toLocaleString('es-AR')}` },
      },
    },
  };

  readonly pieChartOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' },
      tooltip: {
        callbacks: {
          label: (ctx) =>
            ` ${ctx.label}: $${Number(ctx.raw).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
        },
      },
    },
  };

  // Flags para controlar si hay datos suficientes para renderizar cada gráfico
  readonly hasBarData = signal(false);
  readonly hasPieData = signal(false);

  ngOnInit(): void {
    this.dashboardService
      .getSummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
          this.recentTransactions.set(summary.recentTransactions ?? []);
          this.buildCharts(summary);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Error al cargar el dashboard');
          this.loading.set(false);
        },
      });
  }

  /** Prisma serializa Decimal como string — convierte a number seguro */
  toNumber(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    const n = parseFloat(String(value));
    return isNaN(n) ? 0 : n;
  }

  private buildCharts(summary: DashboardSummary): void {
    const currIncome = this.toNumber(summary.monthlyIncome);
    const currExpenses = this.toNumber(summary.monthlyExpenses);
    const prevIncome = this.toNumber(summary.previousMonthIncome);
    const prevExpenses = this.toNumber(summary.previousMonthExpenses);

    this.barChartData = {
      labels: ['Ingresos', 'Gastos'],
      datasets: [
        {
          label: 'Mes anterior',
          data: [prevIncome, prevExpenses],
          backgroundColor: ['rgba(66, 165, 250, 0.75)', 'rgba(239, 83, 80, 0.7)'],
          borderColor: ['#1565c0', '#c62828'],
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Mes actual',
          data: [currIncome, currExpenses],
          backgroundColor: ['rgba(102, 187, 106, 0.85)', 'rgba(255, 167, 38, 0.85)'],
          borderColor: ['#2e7d32', '#e65100'],
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
    this.hasBarData.set(true);

    const categories = summary.expensesByCategory ?? [];
    if (categories.length > 0) {
      this.pieChartData = {
        labels: categories.map((e) => e.categoryName),
        datasets: [
          {
            data: categories.map((e) => this.toNumber(e.total)),
            backgroundColor: [
              '#ef5350', '#ab47bc', '#42a5f5', '#26a69a',
              '#ffca28', '#ff7043', '#66bb6a', '#8d6e63',
            ],
            hoverOffset: 8,
          },
        ],
      };
      this.hasPieData.set(true);
    }
  }

  logout(): void {
    this.authService.logout();
  }
}
