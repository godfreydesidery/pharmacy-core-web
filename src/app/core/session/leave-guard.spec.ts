import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConfirmService } from '../ui/confirm';
import { LeaveGuard, UnsavedWork, guardUnsavedWork } from './leave-guard';

@Component({ template: '' })
class FormPage {
  readonly changed = signal(false);
  readonly unsaved: UnsavedWork = guardUnsavedWork(() => this.changed());
}

describe('LeaveGuard with guardUnsavedWork', () => {
  let guard: LeaveGuard;
  let confirm: ConfirmService;
  let page: FormPage;
  let fixture: ReturnType<typeof TestBed.createComponent<FormPage>>;

  beforeEach(() => {
    fixture = TestBed.createComponent(FormPage);
    page = fixture.componentInstance;
    guard = TestBed.inject(LeaveGuard);
    confirm = TestBed.inject(ConfirmService);
  });

  it('leaves at once when nothing changed', async () => {
    expect(await guard.canLeave()).toBe(true);
    expect(confirm.current()).toBeNull();
    expect(guard.hasUnsaved()).toBe(false);
  });

  it('asks in the app dialog before unsaved work is lost, starting on "Stay"', async () => {
    page.changed.set(true);
    expect(guard.hasUnsaved()).toBe(true);
    const leaving = guard.canLeave();
    const question = confirm.current()!;
    expect(question.icon).toBe('warning');
    expect(question.focus).toBe('cancel');
    confirm.settle(false);
    expect(await leaving).toBe(false);

    const again = guard.canLeave();
    confirm.settle(true);
    expect(await again).toBe(true);
  });

  it('does not ask when nobody can answer (the inactivity sign-out)', async () => {
    page.changed.set(true);
    expect(await guard.canLeave(false)).toBe(true);
    expect(confirm.current()).toBeNull();
  });

  it('leaves without asking once the work is saved, and stops guarding when the page closes', async () => {
    page.changed.set(true);
    page.unsaved.done();
    expect(await guard.canLeave()).toBe(true);
    expect(guard.hasUnsaved()).toBe(false);

    const other = TestBed.createComponent(FormPage);
    other.componentInstance.changed.set(true);
    other.destroy();
    expect(await guard.canLeave()).toBe(true);
  });

  it('asks the browser before a reload while work is unsaved', () => {
    page.changed.set(true);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    fixture.destroy();
    const after = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
});
