import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

const TOKEN_KEY = 'auth_token';

/** Redirige al login si el usuario no está autenticado */
export const authGuard: CanActivateFn = () => {
  if (localStorage.getItem(TOKEN_KEY)) {
    return true;
  }

  return inject(Router).createUrlTree(['/auth/login']);
};
