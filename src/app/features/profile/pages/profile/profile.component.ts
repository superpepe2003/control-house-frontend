import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DatePipe } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../auth/services/auth.service';
import { ProfileService } from '../../services/profile.service';
import { UpdateProfileRequest, UserProfile } from '../../models/profile.models';

/** Validador que compara dos campos del form */
function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPwd = control.get('newPassword')?.value;
  const confirmPwd = control.get('confirmPassword')?.value;
  if (newPwd && confirmPwd && newPwd !== confirmPwd) {
    return { passwordMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DatePipe,
    ReactiveFormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly profile = signal<UserProfile | null>(null);
  readonly loadingProfile = signal(true);
  readonly savingInfo = signal(false);
  readonly savingPassword = signal(false);
  readonly showNewPasswordFields = signal(false);

  readonly infoForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
  });

  readonly passwordForm = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(72)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordMatchValidator },
  );

  ngOnInit(): void {
    this.profileService
      .getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.profile.set(data);
          this.infoForm.patchValue({ name: data.name, email: data.email });
          this.loadingProfile.set(false);
          // markForCheck garantiza que los valores del form se reflejen
          // en los inputs con ChangeDetectionStrategy.OnPush
          this.cdr.markForCheck();
        },
        error: () => {
          this.snackBar.open('Error al cargar el perfil', 'Cerrar', { duration: 3000 });
          this.loadingProfile.set(false);
        },
      });
  }

  saveInfo(): void {
    if (this.infoForm.invalid) return;

    this.savingInfo.set(true);
    const { name, email } = this.infoForm.getRawValue();
    const request: UpdateProfileRequest = {};

    if (name) request.name = name;
    if (email) request.email = email;

    this.profileService
      .updateProfile(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.profile.set(updated);
          this.snackBar.open('Perfil actualizado exitosamente', 'Cerrar', { duration: 3000 });
          this.savingInfo.set(false);
        },
        error: (err) => {
          const msg = err?.error?.message ?? 'Error al actualizar el perfil';
          this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
          this.savingInfo.set(false);
        },
      });
  }

  /** Al ingresar la contraseña actual y presionar continuar, habilita los campos de nueva contraseña */
  unlockNewPassword(): void {
    const currentPwd = this.passwordForm.get('currentPassword');
    if (!currentPwd?.value) {
      currentPwd?.markAsTouched();
      return;
    }
    this.showNewPasswordFields.set(true);
  }

  savePassword(): void {
    if (this.passwordForm.invalid) return;

    this.savingPassword.set(true);
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();

    this.profileService
      .updateProfile({ password: newPassword!, currentPassword: currentPassword! })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Contraseña actualizada exitosamente', 'Cerrar', { duration: 3000 });
          this.passwordForm.reset();
          this.showNewPasswordFields.set(false);
          this.savingPassword.set(false);
        },
        error: (err) => {
          const msg = err?.error?.message ?? 'Error al cambiar la contraseña';
          this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
          this.savingPassword.set(false);
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
