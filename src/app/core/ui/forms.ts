import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { AbstractControl, FormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiError } from '../api/api-error';
import { SessionStore } from '../session/session.store';
import { IconComponent } from './icon.component';

/**
 * Puts the API's refusal on the form control it names, so the field shows it. Returns whether a
 * control took it; otherwise the caller shows it as a general message.
 */
export function applyApiError(form: AbstractControl, failure: unknown): boolean {
  const error = ApiError.from(failure);
  const path = error.controlPath;
  if (!path) {
    return false;
  }
  const control = form.get(path) ?? form.get(path.split('.').pop() ?? '');
  if (!control) {
    return false;
  }
  control.setErrors({ ...(control.errors ?? {}), api: error.message });
  control.markAsTouched();
  return true;
}

/** The message to show under a control: the API's, or a generic one for a local rule. */
export function controlError(control: AbstractControl | null): string | null {
  if (!control || !control.errors || !(control.touched || control.dirty)) {
    return null;
  }
  const errors = control.errors;
  if (typeof errors['api'] === 'string') {
    return errors['api'];
  }
  if (errors['required']) {
    return 'Required';
  }
  if (errors['email']) {
    return 'Enter a valid email address';
  }
  if (errors['min']) {
    return `Must be at least ${errors['min'].min}`;
  }
  if (errors['max']) {
    return `Must be at most ${errors['max'].max}`;
  }
  if (errors['minlength']) {
    return `At least ${errors['minlength'].requiredLength} characters`;
  }
  if (errors['pattern']) {
    return 'Invalid format';
  }
  return 'Invalid value';
}

/** Marks every control touched so their errors show, and says whether the form is valid. */
export function validate(form: FormGroup): boolean {
  form.markAllAsTouched();
  return form.valid;
}

/** Shown on a branch page while "All branches" is chosen. */
@Component({
  selector: 'app-branch-required',
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card card-pad empty">
      <app-icon name="building" [size]="34" [stroke]="1.4" />
      <b>Choose a branch</b>
      <span>{{ what() }} happens at one branch. Pick it in the top bar.</span>
      @if (session.branches().length === 0) {
        <div style="margin-top:12px">
          <a class="btn sm" routerLink="/workspace">Choose workspace</a>
        </div>
      }
    </div>
  `,
})
export class BranchRequiredComponent {
  protected readonly session = inject(SessionStore);
  readonly what = input('This work');
}
