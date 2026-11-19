import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SettingsStore } from '../format/settings.store';

/** How the app looks: the modern look, or a Windows 2000 style one. Chosen per pharmacy. */
export type Look = 'PREMIUM' | 'CLASSIC';
const KEY = 'pharmacy-core.look';

function stored(): Look {
  try {
    return localStorage.getItem(KEY) === 'CLASSIC' ? 'CLASSIC' : 'PREMIUM';
  } catch {
    return 'PREMIUM';
  }
}

/**
 * The pharmacy's look (its settings), applied as `data-look` on the document element. The last
 * look is remembered in the browser so a reload does not flash the other one while the settings
 * load; signing out goes back to the premium look.
 */
@Injectable({ providedIn: 'root' })
export class LookService {
  private readonly settings = inject(SettingsStore);
  private readonly state = signal<Look>(stored());

  readonly look = this.state.asReadonly();
  readonly classic = computed(() => this.state() === 'CLASSIC');

  constructor() {
    effect(() => {
      const look = this.settings.settings()?.look;
      if (look) {
        this.state.set(look === 'CLASSIC' ? 'CLASSIC' : 'PREMIUM');
      }
    });
    effect(() => {
      const look = this.state();
      const root = document.documentElement;
      if (look === 'CLASSIC') {
        root.setAttribute('data-look', 'classic');
      } else {
        root.removeAttribute('data-look');
      }
      try {
        localStorage.setItem(KEY, look);
      } catch {
        /* ignore */
      }
    });
  }

  /** Back to the premium look, for the pages outside a pharmacy (signing in). */
  reset(): void {
    this.state.set('PREMIUM');
  }
}
