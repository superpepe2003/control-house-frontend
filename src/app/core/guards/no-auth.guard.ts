import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../features/auth/services/auth.service';

/** Redirige al dashboard si el usuario ya tiene sesión activa */
export const noAuthGuard: CanActivateFn = () => {
  if (!inject(AuthService).isAuthenticated()) {
    return true;
  }

  return inject(Router).createUrlTree(['/dashboard']);
};
