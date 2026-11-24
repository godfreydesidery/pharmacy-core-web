import { Component, Type, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { provideRouter } from '@angular/router';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from './core/api/api-error';
import { Api } from './core/api/api.service';
import { Settings } from './core/api/models';
import { SettingsStore } from './core/format/settings.store';
import { ShellComponent } from './core/layout/shell.component';
import { SessionStore } from './core/session/session.store';
import { ConfirmDialogComponent, ConfirmService } from './core/ui/confirm';
import { FieldComponent } from './core/ui/field';
import { ModalComponent } from './core/ui/overlay.components';
import SignInPage from './features/auth/sign-in.page';
import AdjustmentsPage from './features/inventory/adjustments.page';
import PosPage from './features/pos/pos.page';
import ReceiptFormPage from './features/purchasing/receipt-form.page';

/**
 * The automated accessibility check (axe-core, WCAG 2.2 A and AA rules) on the shared components
 * and the key pages, rendered in jsdom against a stub API: no backend is needed, so CI runs it
 * on every change. A serious or critical violation fails it.
 *
 * Off here, and why: colour contrast (jsdom lays nothing out; `npm run a11y:contrast` checks the
 * design tokens in every look) and `region` (a component rendered alone sits in no landmark; the
 * shell test covers the landmarks).
 */
const OPTIONS: axe.RunOptions = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
  rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  resultTypes: ['violations'],
};

/** The violations that fail the check, each as "rule: what, where". */
async function serious(root: Element): Promise<string[]> {
  const results = await axe.run(root, OPTIONS);
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .flatMap((v) => v.nodes.map((n) => `${v.id} (${v.impact}): ${v.help} — ${n.target.join(' ')}`));
}

/** Every read answers empty (or not found), every write is refused: only the markup matters. */
const API = {
  get: (path: string) =>
    path.endsWith('/batches') || path === '/categories' || path === '/pos/payment-methods'
      ? Promise.resolve([])
      : path.startsWith('/customers/') ||
          path.startsWith('/purchase-orders/') ||
          path === '/pos/price-plans' ||
          path === '/shifts/current'
        ? Promise.reject(new ApiError(404, 'not_found', 'Not found'))
        : Promise.resolve({ items: [], nextCursor: null }),
  post: () => Promise.resolve([]),
  put: () => Promise.reject(new ApiError(404, 'not_found', 'Not found')),
  delete: () => Promise.reject(new ApiError(404, 'not_found', 'Not found')),
};

@Component({
  imports: [FieldComponent, ModalComponent, ReactiveFormsModule],
  template: `
    <main>
      <h1>Form</h1>
      <form [formGroup]="form">
        <app-field label="Name" [required]="true" hint="As on the invoice" [error]="error()">
          <input class="input" formControlName="name" required />
        </app-field>
        <app-field label="Kind">
          <select class="select" formControlName="kind">
            <option value="a">A</option>
          </select>
        </app-field>
      </form>
      <app-modal [open]="true" title="A dialog">
        <app-field label="Note"><textarea class="input"></textarea></app-field>
        <ng-container footer><button type="button" class="btn">Close</button></ng-container>
      </app-modal>
    </main>
  `,
})
class SharedHost {
  readonly form = new FormGroup({
    name: new FormControl('', Validators.required),
    kind: new FormControl('a'),
  });
  readonly error = signal<string | null>('Enter a name');
}

@Component({
  imports: [ConfirmDialogComponent],
  template: `<main><h1>Page</h1></main>
    <app-confirm />`,
})
class ConfirmHost {}

describe('accessibility check with axe-core (no serious or critical violations)', () => {
  let fixture: ComponentFixture<unknown> | undefined;

  beforeEach(() => {
    localStorage.clear();
    window.matchMedia ??= ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Api, useValue: API }],
    });
  });

  afterEach(() => fixture?.destroy());

  function signIn(): void {
    const session = TestBed.inject(SessionStore);
    session.signIn({
      token: 'pcs_abc',
      expiresAt: '2099-01-01T00:00:00Z',
      user: { uid: 'u1', name: 'Amina Said', email: 'a@x.tz', rootAdmin: true },
      memberships: [],
    });
    const branch = { uid: 'b1', code: 'HQ', name: 'Main' };
    session.enterAsRoot(
      { uid: 't1', code: 'AFYA', name: 'Afya', status: 'ACTIVE' } as never,
      [branch] as never,
      branch as never,
    );
    TestBed.inject(SettingsStore).set({
      currency: 'TZS',
      acceptedCurrencies: ['TZS'],
      maxDiscountPercent: 10,
    } as Settings);
  }

  async function render(component: Type<unknown>): Promise<HTMLElement> {
    fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    await fixture.whenStable();
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();
    }
    return document.body;
  }

  it('finds what it should: an unnamed button and an image without alt fail', async () => {
    const bad = document.createElement('div');
    bad.innerHTML = '<button type="button"></button><img src="x.png" /><input type="text" />';
    document.body.appendChild(bad);
    try {
      const found = await serious(bad);
      expect(found.some((v) => v.startsWith('button-name'))).toBe(true);
      expect(found.some((v) => v.startsWith('image-alt'))).toBe(true);
    } finally {
      bad.remove();
    }
  });

  it('the shared field and dialog', async () => {
    expect(await serious(await render(SharedHost))).toEqual([]);
  });

  it('the confirm dialog', async () => {
    const root = await render(ConfirmHost);
    void TestBed.inject(ConfirmService).ask({
      title: 'Record this return?',
      text: 'The refund goes back the way the sale was paid.',
      details: [{ label: 'Refund', value: 'TZS 3,000' }],
      icon: 'warning',
    });
    fixture!.detectChanges();
    await fixture!.whenStable();
    expect(root.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(await serious(root)).toEqual([]);
  });

  it('the sign-in page', async () => {
    expect(await serious(await render(SignInPage))).toEqual([]);
  });

  it('the shell (landmarks, skip link, menus)', async () => {
    signIn();
    expect(await serious(await render(ShellComponent))).toEqual([]);
  });

  it('the till', async () => {
    signIn();
    expect(await serious(await render(PosPage))).toEqual([]);
  });

  it('a goods receipt and a stock adjustment', async () => {
    signIn();
    expect(await serious(await render(ReceiptFormPage))).toEqual([]);
    fixture?.destroy();
    fixture = undefined;
    expect(await serious(await render(AdjustmentsPage))).toEqual([]);
  });
});
