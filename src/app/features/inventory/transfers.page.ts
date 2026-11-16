import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Api } from '../../core/api/api.service';
import { Page, Product, Transfer } from '../../core/api/models';
import { loaded, pagedList } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { LookupComponent } from '../../core/ui/lookup.component';
import { ToastService } from '../../core/ui/toast.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';

interface DraftLine {
  productUid: string;
  productName: string;
  quantity: number;
}

@Component({
  selector: 'app-transfers',
  imports: [TranslatePipe, ...SHARED, LookupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'inventory.branchTransfers' | t }}</h1>
          <p class="sub">
            {{ 'inventory.sendStockToAnotherBranchIt' | t }}
          </p>
        </div>
        <div class="actions">
          @if (session.branch() && otherBranches().length) {
            <button class="btn primary" type="button" (click)="open()">
              <app-icon name="transfer" [size]="16" /> {{ 'inventory.newTransfer' | t }}
            </button>
          }
        </div>
      </div>
      @if (!session.branch()) {
        <app-branch-required [what]="'ui.what.transferring' | t" />
      } @else {
        <div class="card">
          <div class="tabs">
            <button
              type="button"
              [class.active]="direction() === 'OUTGOING'"
              (click)="chosen = true; direction.set('OUTGOING')"
            >
              {{ 'inventory.outgoing' | t }}
            </button>
            <button
              type="button"
              [class.active]="direction() === 'INCOMING'"
              (click)="direction.set('INCOMING')"
            >
              {{ 'inventory.incoming' | t }}
              @if (pendingIncoming(); as n) {
                <span class="badge amber" style="margin-left:6px">{{ n }}</span>
              }
            </button>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'inventory.transfer' | t }}</th>
                  <th>{{ 'inventory.from' | t }}</th>
                  <th>{{ 'inventory.to' | t }}</th>
                  <th>{{ 'inventory.items' | t }}</th>
                  <th>{{ 'inventory.sent' | t }}</th>
                  <th>{{ 'inventory.received' | t }}</th>
                  <th>{{ 'inventory.status' | t }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (t of list.items(); track t.uid) {
                  <tr>
                    <td>
                      <div class="cell-main">
                        <span class="thumb tone-teal"
                          ><app-icon name="transfer" [size]="16"
                        /></span>
                        <div>
                          <b>{{ t.number }}</b>
                          @if (t.note) {
                            <small>{{ t.note }}</small>
                          }
                        </div>
                      </div>
                    </td>
                    <td>{{ t.fromBranchName }}</td>
                    <td>{{ t.toBranchName }}</td>
                    <td style="white-space:normal;max-width:320px">{{ summary(t) }}</td>
                    <td class="muted">{{ t.createdAt | when }}</td>
                    <td class="muted">{{ t.receivedAt | when }}</td>
                    <td><app-status [value]="t.status" /></td>
                    <td class="right">
                      @if (t.status === 'IN_TRANSIT' && t.toBranchUid === session.branch()?.uid) {
                        <button
                          class="btn sm success"
                          type="button"
                          [disabled]="busy()"
                          (click)="receive(t)"
                        >
                          <app-icon name="check" [size]="14" /> {{ 'inventory.receive' | t }}
                        </button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="8">
                      <app-empty
                        [loading]="list.loading()"
                        icon="transfer"
                        [title]="'inventory.noTransfers' | t"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-pager
            [count]="list.items().length"
            [total]="list.total()"
            [hasMore]="list.hasMore()"
            [loading]="list.loading()"
            (more)="list.more()"
          />
        </div>
      }
    </div>

    <app-modal
      [open]="creating()"
      [title]="'inventory.newTransfer' | t"
      [wide]="true"
      (closed)="creating.set(false)"
    >
      <div class="stack">
        <div class="form-grid">
          <div class="field">
            <label>{{ 'inventory.from' | t }}</label
            ><input class="input" [value]="session.branch()?.name ?? ''" disabled />
          </div>
          <div class="field">
            <label>{{ 'inventory.toBranch' | t }}</label>
            <select
              class="select"
              [value]="toBranchUid()"
              (change)="toBranchUid.set($any($event.target).value)"
            >
              <option value="">{{ 'inventory.chooseABranch' | t }}</option>
              @for (b of otherBranches(); track b.uid) {
                <option [value]="b.uid">{{ b.name }}</option>
              }
            </select>
          </div>
          <div class="field full">
            <label>{{ 'inventory.addMedicine' | t }}</label>
            <app-lookup
              path="/stock"
              [placeholder]="'inventory.searchStockAtThisBranch' | t"
              [display]="stockName"
              [detail]="stockDetail"
              [keepText]="false"
              (picked)="addLine($event)"
            />
          </div>
        </div>
        <div class="table-wrap" style="border:1px solid var(--border);border-radius:12px">
          <table class="table compact">
            <thead>
              <tr>
                <th>{{ 'inventory.medicine' | t }}</th>
                <th class="right">{{ 'inventory.quantity' | t }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (line of lines(); track line.productUid; let i = $index) {
                <tr>
                  <td>{{ line.productName }}</td>
                  <td class="right">
                    <input
                      class="input sm"
                      style="width:90px"
                      type="number"
                      min="1"
                      [value]="line.quantity"
                      (input)="setQuantity(i, +$any($event.target).value)"
                    />
                  </td>
                  <td class="right">
                    <button class="icon-btn sm" type="button" (click)="removeLine(i)">
                      <app-icon name="x" [size]="14" />
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3" class="center muted">
                    {{ 'inventory.addTheMedicinesToSendBatches' | t }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="field">
          <label>{{ 'inventory.note' | t }}</label
          ><input class="input" [value]="note()" (input)="note.set($any($event.target).value)" />
        </div>
      </div>
      <ng-container footer>
        <button class="btn" type="button" (click)="creating.set(false)">
          {{ 'inventory.cancel' | t }}
        </button>
        <button
          class="btn primary"
          type="button"
          [disabled]="busy() || !lines().length || !toBranchUid()"
          (click)="create()"
        >
          {{ 'inventory.sendTransfer' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export default class TransfersPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly direction = signal<'OUTGOING' | 'INCOMING'>('OUTGOING');
  protected readonly list = pagedList<Transfer>(() =>
    this.session.branch() ? { path: '/transfers', query: { direction: this.direction() } } : null,
  );
  /** Incoming transfers still in transit to this branch: counted on the tab, opened by default. */
  private readonly incoming = loaded<Page<Transfer>>(() =>
    this.session.branch()
      ? { path: '/transfers', query: { direction: 'INCOMING', limit: 100 } }
      : null,
  );
  protected readonly pendingIncoming = computed(
    () => (this.incoming.value()?.items ?? []).filter((t) => t.status === 'IN_TRANSIT').length,
  );
  protected chosen = false;
  constructor() {
    effect(() => {
      if (!this.chosen && this.pendingIncoming() > 0) {
        this.chosen = true;
        this.direction.set('INCOMING');
      }
    });
  }

  protected readonly otherBranches = computed(() =>
    this.session.branches().filter((b) => b.uid !== this.session.branch()?.uid),
  );
  protected readonly creating = signal(false);
  protected readonly busy = signal(false);
  protected readonly toBranchUid = signal('');
  protected readonly note = signal('');
  protected readonly lines = signal<DraftLine[]>([]);
  protected readonly stockName = (s: { productName: string }) => s.productName;
  protected readonly stockDetail = (s: { quantity: number }) => `${s.quantity} on hand`;

  protected summary(t: Transfer): string {
    return t.lines.map((l) => `${l.quantity} × ${l.productName}`).join(', ');
  }

  protected open(): void {
    this.lines.set([]);
    this.note.set('');
    this.toBranchUid.set('');
    this.creating.set(true);
  }

  protected addLine(item: { productUid: string; productName: string } | Product | null): void {
    if (!item) {
      return;
    }
    const productUid = 'productUid' in item ? item.productUid : item.uid;
    const productName = 'productName' in item ? item.productName : item.name;
    if (this.lines().some((l) => l.productUid === productUid)) {
      return;
    }
    this.lines.update((lines) => [...lines, { productUid, productName, quantity: 1 }]);
  }

  protected setQuantity(index: number, quantity: number): void {
    this.lines.update((lines) =>
      lines.map((l, i) =>
        i === index ? { ...l, quantity: Math.max(1, Math.floor(quantity) || 1) } : l,
      ),
    );
  }

  protected removeLine(index: number): void {
    this.lines.update((lines) => lines.filter((_, i) => i !== index));
  }

  protected async create(): Promise<void> {
    this.busy.set(true);
    try {
      const transfer = await this.api.post<Transfer>('/transfers', {
        toBranchUid: this.toBranchUid(),
        note: this.note() || null,
        lines: this.lines().map(({ productUid, quantity }) => ({ productUid, quantity })),
      });
      this.toasts.success(
        this.translations.t('toast.transferSent', {
          number: transfer.number,
          branch: transfer.toBranchName,
        }),
      );
      this.creating.set(false);
      this.direction.set('OUTGOING');
      await this.list.reload();
    } finally {
      this.busy.set(false);
    }
  }

  protected async receive(transfer: Transfer): Promise<void> {
    this.busy.set(true);
    try {
      await this.api.post(`/transfers/${transfer.uid}/receive`, {});
      this.toasts.success(
        this.translations.t('toast.transferReceived', { number: transfer.number }),
      );
      await Promise.all([this.list.reload(), this.incoming.reload()]);
    } finally {
      this.busy.set(false);
    }
  }
}
