import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'light' | 'dark' | 'system';
const KEY = 'pharmacy-core.theme';

function stored(): Theme {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

/** Light, dark or the system's choice, applied as `data-theme` on the document element. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(stored());

  constructor() {
    effect(() => {
      const theme = this.theme();
      const root = document.documentElement;
      if (theme === 'system') {
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', theme);
      }
      try {
        localStorage.setItem(KEY, theme);
      } catch {
        /* ignore */
      }
    });
  }

  isDark(): boolean {
    const theme = this.theme();
    return (
      theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    );
  }

  toggle(): void {
    this.theme.set(this.isDark() ? 'light' : 'dark');
  }
}
