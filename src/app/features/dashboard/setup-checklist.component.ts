import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Api } from '../../core/api/api.service';
import { SettingsStore } from '../../core/format/settings.store';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';

interface Step {
  key: string;
  path: string;
  done: boolean;
  /** Steps the system cannot check are ticked by hand. */
  manual: boolean;
}

interface Facts {
  branches: number;
  branchDetails: boolean;
  members: number;
  products: number;
  stocked: number;
  openingPosted: boolean;
  foreignCurrencies: string[];
  ratedCurrencies: string[];
}

const STORE = 'pharmacy.setup.';

/**
 * A new pharmacy's first steps, on the dashboard for whoever manages settings: settings, branches,
 * users, products, opening stock, opening balances, exchange rates (when foreign currencies are
 * accepted) and message providers. It hides once everything is done, or when dismissed.
 */
@Component({
  selector: 'app-setup-checklist',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <section class="card card-pad mb checklist">
        <div class="row between">
          <div>
            <h3>{{ 'admin2.setupTitle' | t }}</h3>
            <p class="muted small">
              {{ 'admin2.setupProgress' | t: { done: doneCount(), total: steps().length } }}
            </p>
          </div>
          <button class="btn ghost sm" type="button" (click)="dismiss()">
            {{ 'admin2.setupDismiss' | t }}
          </button>
        </div>
        <div class="bar"><span [style.width.%]="(doneCount() / steps().length) * 100"></span></div>
        <ol>
          @for (s of steps(); track s.key) {
            <li [class.done]="s.done">
              <app-icon [name]="s.done ? 'check' : 'chevron-right'" [size]="15" />
              <a [routerLink]="s.path">{{ 'admin2.setup.' + s.key | t }}</a>
              @if (s.manual && !s.done) {
                <button class="btn ghost sm" type="button" (click)="tick(s.key)">
                  {{ 'admin2.setupMarkDone' | t }}
                </button>
              }
            </li>
          }
        </ol>
      </section>
    }
  `,
  styles: `
    .bar {
      height: 6px;
      border-radius: 6px;
      background: var(--surface-hover);
      margin: 10px 0 6px;
      overflow: hidden;
    }
    .bar span {
      display: block;
      height: 100%;
      background: var(--primary);
    }
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 4px 16px;
    }
    li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
    }
    li.done a {
      color: var(--muted);
      text-decoration: line-through;
    }
    li.done app-icon {
      color: var(--green);
    }
  `,
})
export class SetupChecklistComponent {
  private readonly api = inject(Api);
  private readonly session = inject(SessionStore);
  private readonly settings = inject(SettingsStore);
  private readonly facts = signal<Facts | null>(null);
  private readonly ticked = signal<string[]>([]);
  private readonly dismissed = signal(false);

  protected readonly steps = computed<Step[]>(() => {
    const f = this.facts();
    if (!f) {
      return [];
    }
    const ticked = this.ticked();
    const steps: Step[] = [
      { key: 'settings', path: '/admin/settings', done: ticked.includes('settings'), manual: true },
      { key: 'branches', path: '/admin/branches', done: f.branchDetails, manual: false },
      { key: 'users', path: '/admin/users', done: f.members > 1, manual: false },
      { key: 'products', path: '/catalogue/products', done: f.products > 0, manual: false },
      { key: 'stock', path: '/inventory/stock', done: f.stocked > 0, manual: false },
      { key: 'opening', path: '/finance/opening-balances', done: f.openingPosted, manual: false },
    ];
    if (f.foreignCurrencies.length) {
      steps.push({
        key: 'rates',
        path: '/finance/exchange-rates',
        done: f.foreignCurrencies.every((c) => f.ratedCurrencies.includes(c)),
        manual: false,
      });
    }
    steps.push({
      key: 'providers',
      path: '/admin/notifications',
      done: ticked.includes('providers'),
      manual: true,
    });
    return steps;
  });

  protected readonly doneCount = computed(() => this.steps().filter((s) => s.done).length);

  protected readonly visible = computed(
    () => !this.dismissed() && this.steps().length > 0 && this.doneCount() < this.steps().length,
  );

  constructor() {
    effect(() => {
      const tenant = this.session.tenant()?.uid;
      const base = this.settings.settings()?.currency;
      if (!tenant || !base || !this.session.can('settings.manage')) {
        this.facts.set(null);
        return;
      }
      this.ticked.set(this.read(tenant, 'ticked') ?? []);
      this.dismissed.set(!!this.read(tenant, 'dismissed'));
      const accepted = this.settings.settings()?.acceptedCurrencies ?? [];
      void this.load(
        accepted.filter((c) => c !== base),
        base,
      );
    });
  }

  protected tick(key: string): void {
    const tenant = this.session.tenant()?.uid;
    this.ticked.update((list) => [...new Set([...list, key])]);
    if (tenant) this.write(tenant, 'ticked', this.ticked());
  }

  protected dismiss(): void {
    const tenant = this.session.tenant()?.uid;
    this.dismissed.set(true);
    if (tenant) this.write(tenant, 'dismissed', true);
  }

  private async load(foreign: string[], base: string): Promise<void> {
    const quiet = { noBranch: true, silent: true };
    const safe = <T>(p: Promise<T>) => p.catch(() => null);
    const [branches, members, products, summary, opening, rates] = await Promise.all([
      safe(
        this.api.get<{ phone?: string | null; address?: string | null }[]>(
          '/branches',
          undefined,
          quiet,
        ),
      ),
      safe(this.api.get<{ items: unknown[] }>('/users', { limit: 2 }, quiet)),
      safe(this.api.get<{ items: unknown[] }>('/products', { limit: 1 }, quiet)),
      safe(this.api.get<{ inStock: number; lowStock: number }>('/stock/summary', undefined, quiet)),
      safe(this.api.get<{ posted: unknown | null }>('/opening-balances', undefined, quiet)),
      foreign.length
        ? safe(
            this.api.get<{ items: { base: string; quote: string }[] }>(
              '/fx/rates',
              { limit: 100 },
              quiet,
            ),
          )
        : Promise.resolve(null),
    ]);
    const rated = new Set<string>();
    for (const r of rates?.items ?? []) {
      rated.add(r.base === base ? r.quote : r.base);
    }
    this.facts.set({
      branches: branches?.length ?? 0,
      branchDetails: (branches ?? []).some((b) => !!b.phone && !!b.address),
      members: members?.items.length ?? 0,
      products: products?.items.length ?? 0,
      stocked: (summary?.inStock ?? 0) + (summary?.lowStock ?? 0),
      openingPosted: !!opening?.posted,
      foreignCurrencies: foreign,
      ratedCurrencies: [...rated],
    });
  }

  private read<T>(tenant: string, key: string): T | null {
    try {
      const raw = localStorage.getItem(STORE + tenant + '.' + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private write(tenant: string, key: string, value: unknown): void {
    try {
      localStorage.setItem(STORE + tenant + '.' + key, JSON.stringify(value));
    } catch {
      /* a blocked store only means the choice is not remembered */
    }
  }
}
