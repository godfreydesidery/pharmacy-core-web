import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { AuditEntry } from '../../core/api/security.models';
import { pagedList } from '../../core/data/data';
import { IconComponent } from '../../core/ui/icon.component';
import { DrawerComponent } from '../../core/ui/overlay.components';
import { PagerComponent } from '../../core/ui/widgets';

interface Change {
  key: string;
  before: unknown;
  after: unknown;
  kind: 'added' | 'removed' | 'changed' | 'same';
}

/**
 * The audit trail with filters and a before/after diff of each entry. The tenant's own trail
 * (`/audit`) or, for a root administrator, the platform's (`/platform/audit`).
 */
@Component({
  selector: 'app-audit-log',
  imports: [TranslatePipe, DatePipe, IconComponent, DrawerComponent, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="toolbar">
        <label class="search">
          <app-icon name="search" [size]="16" />
          <input placeholder="Actor (email)…" (change)="actor.set($any($event.target).value)" />
        </label>
        <select class="input" (change)="entityType.set($any($event.target).value)">
          <option value="">{{ 'admin.allRecords' | t }}</option>
          @for (type of types; track type) {
            <option [value]="type">{{ type }}</option>
          }
        </select>
        <input class="input" type="date" (change)="from.set($any($event.target).value)" />
        <input class="input" type="date" (change)="to.set($any($event.target).value)" />
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>{{ 'admin.when' | t }}</th>
              <th>{{ 'admin.who' | t }}</th>
              <th>{{ 'admin.action' | t }}</th>
              <th>{{ 'admin.record' | t }}</th>
              <th>{{ 'admin.changed' | t }}</th>
            </tr>
          </thead>
          <tbody>
            @for (entry of list.items(); track entry.uid) {
              <tr class="clickable" (click)="selected.set(entry)">
                <td class="nowrap">{{ entry.at | date: 'medium' }}</td>
                <td>{{ entry.actor }}</td>
                <td>
                  <span class="action" [class]="tone(entry.action)">{{ label(entry.action) }}</span>
                </td>
                <td>
                  {{ entry.entityType ?? '—' }}
                  @if (entry.entityUid) {
                    <span class="faint mono">{{ entry.entityUid.slice(-8) }}</span>
                  }
                </td>
                <td class="muted">{{ summary(entry) }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="muted center">
                  {{ list.loading() ? 'Loading…' : 'No entries for these filters.' }}
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

    <app-drawer
      [open]="!!selected()"
      [title]="selected() ? label(selected()!.action) : ''"
      (closed)="selected.set(null)"
    >
      @if (selected(); as entry) {
        <dl class="meta">
          <dt>{{ 'admin.when' | t }}</dt>
          <dd>{{ entry.at | date: 'full' }}</dd>
          <dt>{{ 'admin.who' | t }}</dt>
          <dd>{{ entry.actor }}</dd>
          <dt>{{ 'admin.record' | t }}</dt>
          <dd>
            {{ entry.entityType ?? '—' }} <span class="mono faint">{{ entry.entityUid }}</span>
          </dd>
          <dt>{{ 'admin.request' | t }}</dt>
          <dd class="mono faint">{{ entry.correlationId ?? '—' }}</dd>
        </dl>
        <table class="table diff">
          <thead>
            <tr>
              <th>{{ 'admin.field' | t }}</th>
              <th>{{ 'admin.before' | t }}</th>
              <th>{{ 'admin.after' | t }}</th>
            </tr>
          </thead>
          <tbody>
            @for (change of changes(); track change.key) {
              <tr [class]="change.kind">
                <td class="mono">{{ change.key }}</td>
                <td class="before">{{ show(change.before) }}</td>
                <td class="after">{{ show(change.after) }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="3" class="muted">{{ 'admin.noFieldValuesRecorded' | t }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </app-drawer>
  `,
  styles: `
    .toolbar {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      padding: 14px 16px;
    }
    .clickable {
      cursor: pointer;
    }
    .nowrap {
      white-space: nowrap;
    }
    .mono {
      font-family: var(--mono, ui-monospace, monospace);
      font-size: 12px;
    }
    .center {
      text-align: center;
      padding: 24px;
    }
    .action {
      font-size: 11.5px;
      font-weight: 600;
      padding: 3px 9px;
      border-radius: 999px;
      background: var(--surface-2, var(--bg));
    }
    .action.create {
      color: #16a34a;
      background: color-mix(in srgb, #16a34a 12%, transparent);
    }
    .action.update {
      color: var(--primary);
      background: color-mix(in srgb, var(--primary) 12%, transparent);
    }
    .action.delete,
    .action.security {
      color: #dc2626;
      background: color-mix(in srgb, #dc2626 12%, transparent);
    }
    .meta {
      display: grid;
      grid-template-columns: 90px 1fr;
      gap: 6px 12px;
      font-size: 13px;
      margin-bottom: 16px;
    }
    .meta dt {
      color: var(--muted);
    }
    .diff td {
      vertical-align: top;
      word-break: break-word;
    }
    .diff tr.changed .before,
    .diff tr.removed .before {
      background: color-mix(in srgb, #dc2626 10%, transparent);
      text-decoration: line-through;
      text-decoration-color: color-mix(in srgb, #dc2626 60%, transparent);
    }
    .diff tr.changed .after,
    .diff tr.added .after {
      background: color-mix(in srgb, #16a34a 12%, transparent);
    }
  `,
})
export class AuditLogComponent {
  /** `/audit` (the tenant) or `/platform/audit` (the root administrator). */
  readonly path = input('/audit');

  protected readonly types = [
    'User',
    'Role',
    'Membership',
    'Invitation',
    'Passkey',
    'Tenant',
    'Branch',
    'Settings',
    'Product',
    'Customer',
    'Supplier',
    'Sale',
    'PurchaseOrder',
    'GoodsReceipt',
    'Expense',
    'Webhook',
  ];
  protected readonly actor = signal('');
  protected readonly entityType = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly selected = signal<AuditEntry | null>(null);

  protected readonly list = pagedList<AuditEntry>(() => ({
    path: this.path(),
    query: {
      actor: this.actor(),
      entityType: this.entityType(),
      from: this.from(),
      to: this.to(),
    },
    options: { noBranch: true },
  }));

  protected readonly changes = computed<Change[]>(() => {
    const entry = this.selected();
    if (!entry) {
      return [];
    }
    const before = entry.before ?? {};
    const after = entry.after ?? {};
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    return keys.map((key) => {
      const was = before[key];
      const now = after[key];
      const kind = !(key in before)
        ? 'added'
        : !(key in after)
          ? 'removed'
          : JSON.stringify(was) === JSON.stringify(now)
            ? 'same'
            : 'changed';
      return { key, before: was, after: now, kind };
    });
  });

  protected label(action: string): string {
    return action.charAt(0) + action.slice(1).toLowerCase().replace(/_/g, ' ');
  }

  protected tone(action: string): string {
    if (action === 'CREATE') return 'action create';
    if (action === 'UPDATE') return 'action update';
    if (action === 'DELETE') return 'action delete';
    if (/FAILED|LOCKED|REVOKED|DISABLED|REMOVED/.test(action)) return 'action security';
    return 'action';
  }

  protected summary(entry: AuditEntry): string {
    const keys = Object.keys(entry.after ?? entry.before ?? {});
    if (!keys.length) {
      return '';
    }
    return keys.length > 4 ? `${keys.slice(0, 4).join(', ')} +${keys.length - 4}` : keys.join(', ');
  }

  protected show(value: unknown): string {
    if (value === undefined) {
      return '';
    }
    if (value === null) {
      return '∅';
    }
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}
