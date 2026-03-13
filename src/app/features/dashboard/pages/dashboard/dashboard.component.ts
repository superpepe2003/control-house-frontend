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
import { Router, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { AuthService } from '../../../auth/services/auth.service';
import { DashboardService } from '../../services/dashboard.service';
import { DashboardSummary, PrevMonthTotals } from '../../models/dashboard.models';
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
    MatDividerModule,
    BaseChartDirective,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly summary = signal<DashboardSummary | null>(null);

  readonly recentTransactions = signal<Transaction[]>([]);
  readonly displayedColumns = ['date', 'description', 'category', 'type', 'amount'];

  // ── Gráfico de barras (comparativo mes anterior vs mes actual) ──
  readonly barChartData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });
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

  // ── Gráfico de torta (gastos por categoría) ──
  readonly pieChartData = signal<ChartData<'pie'>>({ labels: [], datasets: [] });
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

  ngOnInit(): void {
    this.dashboardService
      .getFullDashboard()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ summary, prevMonth }) => {
          this.summary.set(summary);
          this.recentTransactions.set(summary.recentTransactions);
          this.buildCharts(summary, prevMonth);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Error al cargar el dashboard');
          this.loading.set(false);
        },
      });
  }

  /** Prisma serializa Decimal como string — lo convertimos a number */
  toNumber(value: string | number): number {
    return parseFloat(String(value));
  }

  private buildCharts(summary: DashboardSummary, prevMonth: PrevMonthTotals): void {
    const currIncome = this.toNumber(summary.monthlyIncome);
    const currExpenses = this.toNumber(summary.monthlyExpenses);

    // Barras agrupadas: [Ingresos, Gastos] — dataset por mes
    this.barChartData.set({
      labels: ['Ingresos', 'Gastos'],
      datasets: [
        {
          label: 'Mes anterior',
          data: [prevMonth.income, prevMonth.expenses],
          backgroundColor: ['rgba(66, 165, 250, 0.7)', 'rgba(239, 83, 80, 0.65)'],
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
    });

    // Torta: gastos por categoría del mes actual
    if (summary.expensesByCategory.length > 0) {
      this.pieChartData.set({
        labels: summary.expensesByCategory.map((e) => e.categoryName),
        datasets: [
          {
            data: summary.expensesByCategory.map((e) => this.toNumber(e.total)),
            backgroundColor: [
              '#ef5350', '#ab47bc', '#42a5f5', '#26a69a',
              '#ffca28', '#ff7043', '#66bb6a', '#8d6e63',
            ],
            hoverOffset: 8,
          },
        ],
      });
    }
  }

  navigate(route: string): void {
    this.router.navigate([route]);
  }

  logout(): void {
    this.authService.logout();
  }
}
