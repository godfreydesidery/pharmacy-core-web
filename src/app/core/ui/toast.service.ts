import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Where a click on the toast goes; without one a click only dismisses it. */
  link?: string;
}

export interface ToastOptions {
  /** How long it stays, in milliseconds. */
  ttl?: number;
  link?: string;
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

  info(message: string, options: ToastOptions = {}): void {
    this.show('info', message, options.ttl, options.link);
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((toast) => toast.id !== id));
  }

  /** At most three at once; the same message again replaces the earlier one instead of stacking. */
  private show(kind: ToastKind, message: string, ttl = 2800, link?: string): void {
    const id = this.nextId++;
    this.items.update((list) => [
      ...list.filter((toast) => toast.message !== message).slice(-(MAX_TOASTS - 1)),
      { id, kind, message, link },
    ]);
    setTimeout(() => this.dismiss(id), ttl);
  }
}
