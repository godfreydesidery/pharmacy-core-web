import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../api/api-error';
import { Api } from '../api/api.service';
import { SessionStore } from '../session/session.store';
import { TENANT_NAV } from './nav';
import { SIDEBAR_KEY, ShellComponent } from './shell.component';

/** Every read fails quietly: the shell's own chrome is what is tested. */
const API = {
  get: () => Promise.reject(new ApiError(404, 'not_found', 'Not found')),
  post: () => Promise.reject(new ApiError(404, 'not_found', 'Not found')),
};

describe('ShellComponent (Batch 10: UX-16, UX-17, UX-18)', () => {
  beforeEach(() => {
    localStorage.removeItem(SIDEBAR_KEY);
    // jsdom has no media queries: a desktop-wide window that prefers light.
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
  });

  afterEach(() => localStorage.removeItem(SIDEBAR_KEY));

  async function render() {
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const $ = <T extends Element = HTMLElement>(selector: string) => {
      fixture.detectChanges();
      return host.querySelector<T & Element>(selector) as T | null;
    };
    return { fixture, host, $ };
  }

  const key = (target: Element, name: string) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('remembers whether the sidebar is folded (UX-18)', async () => {
    const first = await render();
    expect(first.host.classList.contains('collapsed')).toBe(false);
    first.$<HTMLButtonElement>('.topbar .icon-btn')!.click();
    first.fixture.detectChanges();
    TestBed.tick();
    expect(localStorage.getItem(SIDEBAR_KEY)).toBe('1');
    first.fixture.destroy();
    const second = await render();
    second.fixture.detectChanges();
    expect(second.host.classList.contains('collapsed')).toBe(true);
  });

  it('starts open when storage cannot be read', async () => {
    const real = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('blocked');
    };
    try {
      const { host } = await render();
      expect(host.classList.contains('collapsed')).toBe(false);
    } finally {
      Storage.prototype.getItem = real;
    }
  });

  it('offers "Skip to content" first, and it moves the focus to the page (UX-17)', async () => {
    const { host, $ } = await render();
    const skip = host.firstElementChild as HTMLAnchorElement;
    expect(skip.classList.contains('skip-link')).toBe(true);
    expect(skip.textContent?.trim()).toBe('Skip to content');
    skip.click();
    expect(document.activeElement).toBe($('#main-content'));
  });

  it('works the user menu with the keyboard: arrows, Home/End, Escape back to the button (UX-16)', async () => {
    const { $ } = await render();
    const chip = $<HTMLButtonElement>('.user-chip')!;
    expect(chip.getAttribute('aria-haspopup')).toBe('menu');
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    chip.focus();
    key(chip, 'ArrowDown');
    await tick();
    const items = () =>
      Array.from(document.querySelectorAll<HTMLElement>('#user-menu [role="menuitem"]'));
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    expect(items()).toHaveLength(3);
    expect(document.activeElement).toBe(items()[0]);
    key(items()[0], 'ArrowDown');
    expect(document.activeElement).toBe(items()[1]);
    key(items()[1], 'End');
    expect(document.activeElement).toBe(items()[2]);
    key(items()[2], 'ArrowDown');
    expect(document.activeElement).toBe(items()[0]); // wraps
    key(items()[0], 'ArrowUp');
    expect(document.activeElement).toBe(items()[2]);
    key(items()[2], 'Home');
    expect(document.activeElement).toBe(items()[0]);
    key(items()[0], 'Escape');
    $('#user-menu');
    expect($('#user-menu')).toBeNull();
    expect(document.activeElement).toBe(chip);
    key(chip, 'ArrowUp');
    await tick();
    expect(document.activeElement).toBe(items()[2]); // Up opens on the last item
  });

  it('gathers the supplier tasks under one Suppliers group (UX-18)', async () => {
    const group = TENANT_NAV.find((item) => item.id === 'suppliers');
    expect(group?.children?.map((c) => c.path)).toEqual([
      '/suppliers',
      '/purchasing/supplier-balances',
      '/finance/supplier-payments',
      '/purchasing/supplier-returns',
    ]);
    const elsewhere = TENANT_NAV.filter((item) => item.id !== 'suppliers')
      .flatMap((item) => item.children ?? [])
      .filter((link) => /supplier/.test(link.path));
    expect(elsewhere).toEqual([]);
    const { $ } = await render();
    const labels = Array.from($('.nav')!.querySelectorAll<HTMLElement>('.group .sub a')).map((a) =>
      a.textContent?.trim(),
    );
    expect(labels).toContain('All suppliers');
  });
});
