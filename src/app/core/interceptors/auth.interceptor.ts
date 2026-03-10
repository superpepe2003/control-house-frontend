import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../../features/auth/services/auth.service';

/** Agrega el JWT en el header Authorization de cada request HTTP */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (token) {
    const authedReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    return next(authedReq);
  }

  return next(req);
};
