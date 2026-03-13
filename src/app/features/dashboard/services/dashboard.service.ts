import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { formatDate } from '@angular/common';
import { forkJoin, map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DashboardSummary, PrevMonthTotals } from '../models/dashboard.models';
import { Transaction } from '../../transactions/models/transaction.models';

interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

interface TransactionsApiResponse {
  statusCode: number;
  message: string;
  data: Transaction[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getSummary(): Observable<DashboardSummary> {
    return this.http
      .get<ApiResponse<DashboardSummary>>(`${this.apiUrl}/dashboard`)
      .pipe(map((r) => r.data));
  }

  /** Obtiene totales del mes anterior desde el endpoint de transacciones */
  getPrevMonthTotals(): Observable<PrevMonthTotals> {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);

    const params = new HttpParams()
      .set('dateFrom', formatDate(firstDay, 'yyyy-MM-dd', 'en-US'))
      .set('dateTo', formatDate(lastDay, 'yyyy-MM-dd', 'en-US'))
      .set('limit', '500')
      .set('page', '1');

    return this.http
      .get<TransactionsApiResponse>(`${this.apiUrl}/transactions`, { params })
      .pipe(
        map((r) => {
          const transactions = r.data ?? [];
          const income = transactions
            .filter((t) => t.type === 'INCOME')
            .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
          const expenses = transactions
            .filter((t) => t.type === 'EXPENSE')
            .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
          return { income, expenses };
        }),
      );
  }

  /** Llama ambos endpoints en paralelo */
  getFullDashboard(): Observable<{ summary: DashboardSummary; prevMonth: PrevMonthTotals }> {
    return forkJoin({
      summary: this.getSummary(),
      prevMonth: this.getPrevMonthTotals(),
    });
  }
}
