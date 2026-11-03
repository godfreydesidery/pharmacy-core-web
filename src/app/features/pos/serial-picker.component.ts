import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Api } from '../../core/api/api.service';
import { SellableProduct, SerialUnit } from '../../core/api/models';
import { SHARED } from '../../core/shared';
import { TranslatePipe } from '../../core/i18n/t.pipe';

/**
 * Chooses the units of a serial-tracked product to sell, such as wheelchair WCH-0002: scan or type
 * a serial number (Enter adds it), or tick the units in stock at this branch.
 */
@Component({
  selector: 'app-serial-picker',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal
      [open]="!!product()"
      [title]="'Serial numbers · ' + (product()?.name ?? '')"
      (closed)="closed.emit()"
    >
      <div class="stack">
        <label class="search scan">
          <app-icon name="barcode" [size]="16" />
          <input
            #scan
            [placeholder]="'pos.scanOrTypeASerialNumber' | t"
            autocomplete="off"
            (keydown.enter)="addTyped(scan.value); scan.value = ''; $event.preventDefault()"
          />
        </label>
        @if (unknown()) {
          <div class="notice tone-red">
            <app-icon name="x" /> {{ unknown() }} is not in stock at this branch.
          </div>
        }
        <div class="units">
          @for (u of units(); track u.uid) {
            <label class="unit" [class.on]="chosen().has(u.serialNumber)">
              <input
                type="checkbox"
                [checked]="chosen().has(u.serialNumber)"
                (change)="toggle(u.serialNumber)"
              />
              <span class="mono">{{ u.serialNumber }}</span>
              <small>Batch {{ u.batchNumber }}</small>
            </label>
          } @empty {
            <app-empty
              [loading]="loading()"
              icon="barcode"
              [title]="'pos.noUnitsInStockHere' | t"
            />
          }
        </div>
      </div>
      <ng-container footer>
        <span class="muted grow">{{ chosen().size }} selected</span>
        <button class="btn" type="button" (click)="closed.emit()">{{ 'pos.cancel' | t }}</button>
        <button
          class="btn primary"
          type="button"
          [disabled]="!chosen().size"
          (click)="picked.emit(selection())"
        >
          <app-icon name="check" [size]="16" /> Add {{ chosen().size || '' }} to sale
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .scan {
      width: 100%;
    }
    .units {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 8px;
      max-height: 320px;
      overflow: auto;
    }
    .unit {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 12px;
      cursor: pointer;
      position: relative;
    }
    .unit.on {
      border-color: var(--primary);
      background: color-mix(in srgb, var(--primary) 8%, transparent);
    }
    .unit input {
      position: absolute;
      top: 10px;
      right: 10px;
    }
    .unit small {
      color: var(--muted);
      font-size: 11.5px;
    }
    .grow {
      flex: 1;
    }
  `,
})
export class SerialPickerComponent {
  private readonly api = inject(Api);
  readonly product = input<SellableProduct | null>(null);
  /** The serials already on the sale for this product. */
  readonly selected = input<string[]>([]);
  readonly picked = output<string[]>();
  readonly closed = output<void>();

  protected readonly units = signal<SerialUnit[]>([]);
  protected readonly loading = signal(false);
  protected readonly chosen = signal<Set<string>>(new Set());
  protected readonly unknown = signal<string | null>(null);
  protected readonly selection = computed(() => [...this.chosen()]);

  constructor() {
    effect(() => {
      const product = this.product();
      this.chosen.set(new Set(this.selected()));
      this.unknown.set(null);
      this.units.set([]);
      if (product) {
        void this.load(product.productUid);
      }
    });
  }

  private async load(productUid: string): Promise<void> {
    this.loading.set(true);
    try {
      this.units.set(
        await this.api.get<SerialUnit[]>(`/stock/${productUid}/serials`, { status: 'IN_STOCK' }),
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected toggle(serial: string): void {
    const next = new Set(this.chosen());
    if (next.has(serial)) {
      next.delete(serial);
    } else {
      next.add(serial);
    }
    this.chosen.set(next);
  }

  /** A scanned serial is ticked when it is in stock here; otherwise it is flagged. */
  protected addTyped(value: string): void {
    const serial = value.trim();
    if (!serial) {
      return;
    }
    const match = this.units().find((u) => u.serialNumber.toLowerCase() === serial.toLowerCase());
    if (!match) {
      this.unknown.set(serial);
      return;
    }
    this.unknown.set(null);
    this.chosen.set(new Set([...this.chosen(), match.serialNumber]));
  }
}
