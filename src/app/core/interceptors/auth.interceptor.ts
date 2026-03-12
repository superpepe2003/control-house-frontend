import { HttpInterceptorFn } from '@angular/common/http';

const TOKEN_KEY = 'auth_token';

/** Agrega el JWT en el header Authorization de cada request HTTP */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem(TOKEN_KEY);

  if (token) {
    return next(req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }));
  }

  return next(req);
};
