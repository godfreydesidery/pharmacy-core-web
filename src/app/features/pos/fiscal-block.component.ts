import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import QRCode from 'qrcode';
import { FiscalDocument, Sale } from '../../core/api/models';
import { SettingsStore } from '../../core/format/settings.store';
import { TranslatePipe } from '../../core/i18n/t.pipe';

/** A TIN as printed: 123-456-789 (kept as 9 digits). */
export function printedTin(tin: string | null | undefined): string | null {
  if (!tin) {
    return null;
  }
  return /^\d{9}$/.test(tin) ? `${tin.slice(0, 3)}-${tin.slice(3, 6)}-${tin.slice(6)}` : tin;
}

/** The QR code of a payload, as an SVG data URL (no canvas needed, so it prints and tests alike). */
export async function qrDataUrl(payload: string): Promise<string> {
  const svg = await QRCode.toString(payload, { type: 'svg', margin: 1 });
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

/**
 * The fiscal part of a receipt (STD-1): the pharmacy's TIN and VRN, the fiscal receipt's status and,
 * once the tax authority issued it, its number, verification code, counters and QR code; and the
 * credit notes of the sale's returns.
 */
@Component({
  selector: 'app-fiscal-block',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tin() || vrn()) {
      <div class="center small muted" data-testid="fiscal-seller">
        @if (tin(); as t) {
          <span>{{ 'vat.tin' | t }}: {{ t }}</span>
        }
        @if (tin() && vrn()) {
          <span> · </span>
        }
        @if (vrn(); as v) {
          <span>{{ 'vat.vrn' | t }}: {{ v }}</span>
        }
      </div>
    }
    @if (receipt(); as r) {
      <div class="fiscal" data-testid="fiscal-receipt" [attr.data-status]="r.status">
        @switch (r.status) {
          @case ('ISSUED') {
            <div class="row between small">
              <span class="muted">{{ 'fiscal.receipt' | t }}</span
              ><b data-testid="fiscal-number">{{ r.receiptNumber }}</b>
            </div>
            @if (r.verificationCode) {
              <div class="row between small">
                <span class="muted">{{ 'fiscal.verificationCode' | t }}</span
                ><span>{{ r.verificationCode }}</span>
              </div>
            }
            @if (r.globalCounter !== null) {
              <div class="small muted center">
                {{
                  'fiscal.counters' | t: { global: r.globalCounter, daily: r.dailyCounter ?? '' }
                }}
              </div>
            }
            @if (qr(); as src) {
              <img class="qr" [src]="src" [alt]="'fiscal.qr' | t" data-testid="fiscal-qr" />
            }
          }
          @case ('FAILED') {
            <div class="small error-text" data-testid="fiscal-failed">
              {{ 'fiscal.failed' | t }}
            </div>
          }
          @default {
            <div class="small muted" data-testid="fiscal-pending">{{ 'fiscal.pending' | t }}</div>
          }
        }
      </div>
    }
    @for (note of creditNotes(); track note.uid) {
      <div class="row between small" data-testid="fiscal-credit-note">
        <span class="muted">{{ 'fiscal.creditNote' | t }} · {{ note.sourceNumber }}</span
        ><span>{{
          note.status === 'ISSUED' ? note.receiptNumber : ('enum.' + note.status | t)
        }}</span>
      </div>
    }
  `,
  styles: `
    .fiscal {
      border-top: 1px dashed var(--border);
      padding-top: 6px;
      margin-top: 4px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .small {
      font-size: 11.5px;
    }
    .between {
      justify-content: space-between;
    }
    .qr {
      width: 112px;
      height: 112px;
      margin: 6px auto 0;
      display: block;
      image-rendering: pixelated;
    }
    .error-text {
      color: var(--danger, #b42318);
    }
  `,
})
export class FiscalBlockComponent {
  private readonly settings = inject(SettingsStore);
  readonly sale = input.required<Sale>();

  protected readonly receipt = computed<FiscalDocument | null>(
    () => this.sale().fiscalDocuments?.find((d) => d.kind === 'RECEIPT') ?? null,
  );
  protected readonly creditNotes = computed(() =>
    (this.sale().fiscalDocuments ?? []).filter((d) => d.kind === 'CREDIT_NOTE'),
  );
  /** The TIN and VRN the receipt was issued with, else the pharmacy's while it is registered. */
  protected readonly tin = computed(() =>
    printedTin(
      this.receipt()?.sellerTin ?? (this.registered() ? this.settings.settings()?.tin : null),
    ),
  );
  protected readonly vrn = computed(
    () =>
      this.receipt()?.sellerVrn ??
      (this.registered() ? (this.settings.settings()?.vrn ?? null) : null),
  );
  private readonly registered = computed(() => this.settings.settings()?.vatRegistered ?? false);

  protected readonly qr = signal<string | null>(null);

  constructor() {
    effect(() => {
      const payload = this.receipt()?.status === 'ISSUED' ? this.receipt()?.qrPayload : null;
      if (!payload) {
        this.qr.set(null);
        return;
      }
      qrDataUrl(payload)
        .then((src) => this.qr.set(src))
        .catch(() => this.qr.set(null));
    });
  }
}
