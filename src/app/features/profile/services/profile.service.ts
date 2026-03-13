import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { UpdateProfileRequest, UserProfile } from '../models/profile.models';

interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/users`;

  getProfile(): Observable<UserProfile> {
    return this.http
      .get<ApiResponse<UserProfile>>(`${this.baseUrl}/profile`)
      .pipe(map((r) => r.data));
  }

  updateProfile(data: UpdateProfileRequest): Observable<UserProfile> {
    return this.http
      .patch<ApiResponse<UserProfile>>(`${this.baseUrl}/profile`, data)
      .pipe(map((r) => r.data));
  }
}
