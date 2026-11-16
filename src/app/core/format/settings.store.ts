import { Injectable, computed, inject, signal } from '@angular/core';
import { Api } from '../api/api.service';
import { Settings } from '../api/models';

/** The tenant's settings, loaded once per workspace; the currency formats every amount. */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly api = inject(Api);
  private readonly state = signal<Settings | null>(null);
  private loadedFor: string | null = null;

  readonly settings = this.state.asReadonly();
  /**
   * The base currency, or '' until the settings arrive. Never a guess: a fallback of TZS once made
   * a USD pharmacy's purchase order start in TZS at rate 1.
   */
  readonly currency = computed(() => this.state()?.currency ?? '');
  /** The settings have loaded, so the currency and the accepted currencies are real. */
  readonly ready = computed(() => this.state() !== null);

  async load(tenantUid: string, force = false): Promise<void> {
    if (!force && this.loadedFor === tenantUid && this.state()) {
      return;
    }
    this.loadedFor = tenantUid;
    try {
      this.state.set(await this.api.get<Settings>('/settings', undefined, { silent: true }));
    } catch {
      this.state.set(null);
    }
  }

  set(settings: Settings): void {
    this.state.set(settings);
  }

  clear(): void {
    this.loadedFor = null;
    this.state.set(null);
  }
}
