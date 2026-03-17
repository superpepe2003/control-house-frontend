import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CreateTransactionRequest,
  ListTransactionsParams,
  PaginationMeta,
  Transaction,
  UpdateTransactionRequest,
} from '../models/transaction.models';

interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

/** El backend retorna data: { items: T[], meta: PaginationMeta } para listas paginadas */
interface PaginatedData<T> {
  items: T[];
  meta: PaginationMeta;
}

@Injectable({ providedIn: 'root' })
export class TransactionsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/transactions`;

  getAll(params: ListTransactionsParams): Observable<{ data: Transaction[]; meta: PaginationMeta }> {
    let httpParams = new HttpParams();

    if (params.type) httpParams = httpParams.set('type', params.type);
    if (params.categoryId) httpParams = httpParams.set('categoryId', String(params.categoryId));
    if (params.accountId) httpParams = httpParams.set('accountId', String(params.accountId));
    if (params.dateFrom) httpParams = httpParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) httpParams = httpParams.set('dateTo', params.dateTo);
    if (params.page) httpParams = httpParams.set('page', String(params.page));
    if (params.limit) httpParams = httpParams.set('limit', String(params.limit));

    return this.http
      .get<ApiResponse<PaginatedData<Transaction>>>(this.baseUrl, { params: httpParams })
      .pipe(map((r) => ({ data: r.data.items, meta: r.data.meta })));
  }

  create(data: CreateTransactionRequest): Observable<Transaction> {
    return this.http
      .post<ApiResponse<Transaction>>(this.baseUrl, data)
      .pipe(map((r) => r.data));
  }

  update(id: number, data: UpdateTransactionRequest): Observable<Transaction> {
    return this.http
      .put<ApiResponse<Transaction>>(`${this.baseUrl}/${id}`, data)
      .pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.baseUrl}/${id}`)
      .pipe(map(() => void 0));
  }
}
