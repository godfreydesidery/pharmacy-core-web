import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const MAX_TOASTS = 3;

/** Short-lived notifications in the corner of the screen. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly items = signal<Toast[]>([]);
  readonly toasts = this.items.asReadonly();

  success(message: string): void {
    this.show('success', message);
  }

  error(message: string): void {
    this.show('error', message, 5000);
  }

  info(message: string): void {
    this.show('info', message);
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((toast) => toast.id !== id));
  }

  /** At most three at once; the same message again replaces the earlier one instead of stacking. */
  private show(kind: ToastKind, message: string, ttl = 2800): void {
    const id = this.nextId++;
    this.items.update((list) => [
      ...list.filter((toast) => toast.message !== message).slice(-(MAX_TOASTS - 1)),
      { id, kind, message },
    ]);
    setTimeout(() => this.dismiss(id), ttl);
  }
}
