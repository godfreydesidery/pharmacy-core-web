import { TestBed } from '@angular/core/testing';
import { ConfirmDialogComponent, ConfirmService } from './confirm';

describe('ConfirmService (the queue)', () => {
  let confirm: ConfirmService;

  beforeEach(() => {
    confirm = TestBed.inject(ConfirmService);
  });

  it('keeps a second question waiting and never answers the first with it', async () => {
    let first: boolean | undefined;
    let second: boolean | undefined;
    void confirm.ask({ title: 'First' }).then((ok) => (first = ok));
    void confirm.ask({ title: 'Second' }).then((ok) => (second = ok));
    await Promise.resolve();
    expect(first).toBeUndefined();
    expect(confirm.current()?.title).toBe('First');
    expect(confirm.waiting()).toBe(2);

    confirm.settle(true);
    await Promise.resolve();
    expect(first).toBe(true);
    expect(second).toBeUndefined();
    expect(confirm.current()?.title).toBe('Second');

    confirm.settle(false);
    await Promise.resolve();
    expect(second).toBe(false);
    expect(confirm.current()).toBeNull();
  });

  it('shows an urgent question (the idle warning) in front; the covered one waits, unanswered', async () => {
    let question: boolean | undefined;
    let idle: boolean | undefined;
    void confirm.ask({ title: 'Clear the cart?', icon: 'danger' }).then((ok) => (question = ok));
    void confirm
      .ask({ title: 'Are you still there?', key: 'idle', urgent: true, dismissible: false })
      .then((ok) => (idle = ok));
    expect(confirm.current()?.key).toBe('idle');

    // Another question asked meanwhile waits behind both; it cannot answer the warning.
    void confirm.ask({ title: 'Third' });
    expect(confirm.current()?.key).toBe('idle');

    confirm.settle(true);
    await Promise.resolve();
    expect(idle).toBe(true);
    expect(question).toBeUndefined();
    expect(confirm.current()?.title).toBe('Clear the cart?');
  });

  it('updates and dismisses a named question wherever it waits', async () => {
    let answer: boolean | undefined;
    void confirm.ask({ title: 'On screen' });
    void confirm.ask({ title: 'Waiting', key: 'w', text: 'a' }).then((ok) => (answer = ok));
    confirm.update('w', { text: 'b' });
    confirm.dismiss('w');
    await Promise.resolve();
    expect(answer).toBe(false);
    expect(confirm.waiting()).toBe(1);
  });
});

describe('ConfirmDialogComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
  });
  afterEach(() => vi.useRealTimers());

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    TestBed.tick();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  async function show(): Promise<void> {
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
  }

  it('focuses Cancel on a danger question, so a scanner Enter cannot confirm it', async () => {
    const element = await render();
    const confirm = TestBed.inject(ConfirmService);
    let answer: boolean | undefined;
    void confirm.ask({ title: 'Clear the cart?', icon: 'danger' }).then((ok) => (answer = ok));
    await show();
    const focused = document.activeElement as HTMLElement;
    expect(focused.classList.contains('cancel')).toBe(true);
    const dialog = element.querySelector('[role="alertdialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe(
      'Clear the cart?',
    );

    focused.click(); // Enter on the focused button
    await vi.advanceTimersByTimeAsync(200);
    expect(answer).toBe(false);
  });

  it('focuses the confirm button on an ordinary question', async () => {
    await render();
    void TestBed.inject(ConfirmService).ask({ title: 'Print the receipt?' });
    await show();
    expect((document.activeElement as HTMLElement).classList.contains('ok')).toBe(true);
  });

  it('answers only the question it showed, then shows the next', async () => {
    const element = await render();
    const confirm = TestBed.inject(ConfirmService);
    const answers: string[] = [];
    void confirm.ask({ title: 'One' }).then((ok) => answers.push(`one:${ok}`));
    void confirm.ask({ title: 'Two' }).then((ok) => answers.push(`two:${ok}`));
    await show();
    element.querySelector<HTMLElement>('.ok')!.click();
    await vi.advanceTimersByTimeAsync(200);
    TestBed.tick();
    expect(answers).toEqual(['one:true']);
    expect(element.querySelector('h2')?.textContent).toBe('Two');
  });

  it('ignores Escape when the question is not dismissible (the idle warning)', async () => {
    await render();
    const confirm = TestBed.inject(ConfirmService);
    void confirm.ask({ title: 'Are you still there?', dismissible: false });
    await show();
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    await vi.advanceTimersByTimeAsync(200);
    expect(confirm.current()?.title).toBe('Are you still there?');
    confirm.settle(true);
  });
});
