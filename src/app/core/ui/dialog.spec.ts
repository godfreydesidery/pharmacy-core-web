import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DrawerComponent, ModalComponent } from './overlay.components';

@Component({
  imports: [ModalComponent, DrawerComponent],
  template: `
    <main>
      <button id="opener" type="button" (click)="drawer.set(true)">Open</button>
      <button id="other" type="button">Other</button>
    </main>
    <app-drawer
      [open]="drawer()"
      title="Batches"
      subtitle="Two batches"
      (closed)="drawer.set(false)"
    >
      <input id="drawer-first" />
      <button id="open-modal" type="button" (click)="modal.set(true)">Edit</button>
    </app-drawer>
    <app-modal [open]="modal()" title="Edit batch" (closed)="modal.set(false)">
      <input id="modal-first" />
      <input id="modal-last" />
    </app-modal>
  `,
})
class Host {
  readonly drawer = signal(false);
  readonly modal = signal(false);
}

function key(name: string, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: name,
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  (document.activeElement ?? document.body).dispatchEvent(event);
  return event;
}

describe('the dialogs (modal, drawer)', () => {
  let host: Host;
  let root: HTMLElement;

  /** Lets a close (which may first ask about unsaved changes) run through and render. */
  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
    }
  }
  let fixture: ReturnType<typeof TestBed.createComponent<Host>>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    await settle();
  });

  afterEach(() => fixture.destroy());

  const byId = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
  const active = () => (document.activeElement as HTMLElement | null)?.id;

  it('is labelled by its title, described by its subtitle, and modal', async () => {
    host.drawer.set(true);
    await settle();
    const panel = root.querySelector<HTMLElement>('aside[role="dialog"]')!;
    expect(panel.getAttribute('aria-modal')).toBe('true');
    const title = document.getElementById(panel.getAttribute('aria-labelledby')!);
    expect(title?.textContent).toContain('Batches');
    const description = document.getElementById(panel.getAttribute('aria-describedby')!);
    expect(description?.textContent).toContain('Two batches');
  });

  it('moves the focus in on open, keeps Tab inside, and gives it back on close', async () => {
    byId('opener').focus();
    host.drawer.set(true);
    await settle();
    expect(active()).toBe('drawer-first');

    // Tab from the last control goes round to the first (the close button), Shift+Tab back.
    byId('open-modal').focus();
    expect(key('Tab').defaultPrevented).toBe(true);
    const close = root.querySelector<HTMLElement>('aside header button')!;
    expect(document.activeElement).toBe(close);
    key('Tab', true);
    expect(active()).toBe('open-modal');

    // Focus that wanders outside comes back in.
    byId('other').focus();
    expect(root.querySelector('aside')!.contains(document.activeElement)).toBe(true);

    key('Escape');
    await settle();
    expect(host.drawer()).toBe(false);
    expect(active()).toBe('opener');
  });

  it('closes only the top dialog on Escape, and focus returns into the one below', async () => {
    host.drawer.set(true);
    await settle();
    byId('open-modal').focus();
    host.modal.set(true);
    await settle();
    expect(active()).toBe('modal-first');

    // Tab is trapped in the top dialog only.
    byId('modal-last').focus();
    key('Tab');
    expect(root.querySelector('section.modal')!.contains(document.activeElement)).toBe(true);

    key('Escape');
    await settle();
    expect(host.modal()).toBe(false);
    expect(host.drawer()).toBe(true);
    expect(active()).toBe('open-modal');

    key('Escape');
    await settle();
    expect(host.drawer()).toBe(false);
  });

  it('never leaves the focus nowhere when what opened the dialog is gone', async () => {
    byId('opener').focus();
    host.drawer.set(true);
    await settle();
    byId('opener').remove(); // the sale's Complete button, gone once the sale is done
    key('Escape');
    await settle();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement?.tagName).toBe('MAIN');
  });
});
