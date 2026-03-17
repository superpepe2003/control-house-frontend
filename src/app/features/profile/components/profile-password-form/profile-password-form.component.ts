import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ProfileService } from '../../services/profile.service';

/** Validador cross-field que compara newPassword y confirmPassword */
function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPwd = control.get('newPassword')?.value;
  const confirmPwd = control.get('confirmPassword')?.value;
  if (newPwd && confirmPwd && newPwd !== confirmPwd) {
    return { passwordMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-profile-password-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './profile-password-form.component.html',
  styleUrl: './profile-password-form.component.scss',
})
export class ProfilePasswordFormComponent {
  private readonly profileService = inject(ProfileService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly saving = signal(false);
  readonly showNewFields = signal(false);

  // Formulario tipado con nonNullable para evitar non-null assertions en save()
  readonly form = new FormGroup(
    {
      currentPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      newPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(6), Validators.maxLength(72)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: passwordMatchValidator },
  );

  save(): void {
    if (this.form.invalid) return;

    this.saving.set(true);
    const { currentPassword, newPassword } = this.form.getRawValue();

    this.profileService
      .updateProfile({ password: newPassword, currentPassword })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Contraseña actualizada exitosamente', 'Cerrar', { duration: 3000 });
          this.form.reset();
          this.showNewFields.set(false);
          this.saving.set(false);
        },
        error: (err) => {
          const msg = err?.error?.message ?? 'Error al cambiar la contraseña';
          this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
          this.saving.set(false);
        },
      });
  }
}
