import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../auth/services/auth.service';
import { ProfileService } from '../../services/profile.service';
import { UserProfile } from '../../models/profile.models';
import { ProfileInfoFormComponent } from '../../components/profile-info-form/profile-info-form.component';
import { ProfilePasswordFormComponent } from '../../components/profile-password-form/profile-password-form.component';

@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    ProfileInfoFormComponent,
    ProfilePasswordFormComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = signal<UserProfile | null>(null);
  readonly loadingProfile = signal(true);
  readonly errorProfile = signal<string | null>(null);

  // Evita requests concurrentes al reintentar
  private loadInFlight = false;

  ngOnInit(): void {
    this.loadProfile();
  }

  protected loadProfile(): void {
    if (this.loadInFlight) return;
    this.loadInFlight = true;
    this.loadingProfile.set(true);
    this.errorProfile.set(null);

    this.profileService
      .getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.loadInFlight = false;
          this.profile.set(data);
          this.loadingProfile.set(false);
        },
        error: () => {
          this.loadInFlight = false;
          this.errorProfile.set('No se pudo cargar el perfil. Verificá tu conexión e intentá nuevamente.');
          this.loadingProfile.set(false);
        },
      });
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.authService.logout();
  }
}
