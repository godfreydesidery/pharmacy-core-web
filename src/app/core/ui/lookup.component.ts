import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Api, Query } from '../api/api.service';
import { Page } from '../api/models';
import { IconComponent } from './icon.component';

/**
 * A search box that queries a paged list route with `q` and lets the user pick one result, such
 * as a customer at the POS or a product on a purchase order line.
 */
@Component({
  selector: 'app-lookup',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'outside($event)' },
  template: `
    <div class="lookup">
      <label class="search" [class.sm]="small()">
        <app-icon name="search" [size]="15" />
        <input
          [placeholder]="placeholder()"
          [value]="text()"
          (input)="type($any($event.target).value)"
          (focus)="focus()"
          (keydown.escape)="open.set(false)"
          (keydown.enter)="$event.preventDefault(); pickFirst()"
        />
        @if (text()) {
          <button type="button" class="icon-btn sm" (click)="clear()" aria-label="Clear">
            <app-icon name="x" [size]="14" />
          </button>
        }
      </label>
      @if (open()) {
        <div class="results">
          @for (item of results(); track $index) {
            <button type="button" (click)="pick(item)">
              <b>{{ display()(item) }}</b>
              @if (detail()(item); as d) {
                <small>{{ d }}</small>
              }
            </button>
          } @empty {
            <div class="none">{{ loading() ? 'Searching…' : 'No match' }}</div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .lookup {
      position: relative;
    }
    .search {
      min-width: 0;
      width: 100%;
    }
    .search.sm {
      height: 32px;
    }
    .results {
      position: absolute;
      left: 0;
      right: 0;
      top: calc(100% + 4px);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: var(--shadow);
      max-height: 280px;
      overflow-y: auto;
      z-index: 60;
      padding: 4px;
    }
    .results button {
      display: block;
      width: 100%;
      text-align: left;
      border: 0;
      background: none;
      padding: 8px 10px;
      border-radius: 8px;
      cursor: pointer;
    }
    .results button:hover {
      background: var(--surface-hover);
    }
    .results b {
      display: block;
      font-weight: 550;
      font-size: 13px;
    }
    .results small {
      color: var(--muted);
      font-size: 11.5px;
    }
    .none {
      padding: 10px;
      color: var(--faint);
      font-size: 12.5px;
    }
  `,
})
export class LookupComponent {
  private readonly api = inject(Api);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly path = input.required<string>();
  readonly query = input<Query>({});
  readonly placeholder = input('Search…');
  readonly small = input(false);
  readonly display = input<(item: any) => string>((item) => String(item?.name ?? ''));
  readonly detail = input<(item: any) => string | null>(() => null);
  /** Keeps the chosen item's label in the box after a pick. */
  readonly keepText = input(true);
  readonly picked = output<any>();

  protected readonly text = signal('');
  protected readonly results = signal<unknown[]>([]);
  protected readonly loading = signal(false);
  protected readonly open = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;

  /** Shows a label without searching, such as the customer already chosen. */
  setText(value: string): void {
    this.text.set(value);
  }

  protected focus(): void {
    this.open.set(true);
    void this.search(this.keepText() ? '' : this.text());
  }

  protected type(value: string): void {
    this.text.set(value);
    this.open.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.search(value), 220);
  }

  protected pick(item: unknown): void {
    this.picked.emit(item);
    this.text.set(this.keepText() ? this.display()(item) : '');
    this.open.set(false);
  }

  protected pickFirst(): void {
    const first = this.results()[0];
    if (first !== undefined) {
      this.pick(first);
    }
  }

  protected clear(): void {
    this.text.set('');
    this.picked.emit(null);
    this.results.set([]);
  }

  protected outside(event: MouseEvent): void {
    if (!(this.host.nativeElement as HTMLElement).contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  private async search(q: string): Promise<void> {
    const mine = ++this.generation;
    this.loading.set(true);
    try {
      const page = await this.api.get<Page<unknown>>(
        this.path(),
        { ...this.query(), q, limit: 12 },
        { silent: true },
      );
      if (mine === this.generation) {
        this.results.set(page.items);
      }
    } catch {
      if (mine === this.generation) {
        this.results.set([]);
      }
    } finally {
      if (mine === this.generation) {
        this.loading.set(false);
      }
    }
  }
}
