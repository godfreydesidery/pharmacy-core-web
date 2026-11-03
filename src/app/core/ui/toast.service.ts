import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

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
    this.show('error', message, 6000);
  }

  info(message: string): void {
    this.show('info', message);
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((toast) => toast.id !== id));
  }

  private show(kind: ToastKind, message: string, ttl = 3500): void {
    const id = this.nextId++;
    this.items.update((list) => [...list.slice(-4), { id, kind, message }]);
    setTimeout(() => this.dismiss(id), ttl);
  }
}
