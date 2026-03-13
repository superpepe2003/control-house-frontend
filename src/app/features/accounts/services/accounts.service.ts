import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Account, CreateAccountRequest, UpdateAccountRequest } from '../models/account.models';

interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/accounts`;

  getAll(): Observable<Account[]> {
    return this.http.get<ApiResponse<Account[]>>(this.baseUrl).pipe(map((r) => r.data));
  }

  getById(id: number): Observable<Account> {
    return this.http.get<ApiResponse<Account>>(`${this.baseUrl}/${id}`).pipe(map((r) => r.data));
  }

  create(data: CreateAccountRequest): Observable<Account> {
    return this.http.post<ApiResponse<Account>>(this.baseUrl, data).pipe(map((r) => r.data));
  }

  update(id: number, data: UpdateAccountRequest): Observable<Account> {
    return this.http.put<ApiResponse<Account>>(`${this.baseUrl}/${id}`, data).pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
