import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FIELDS } from './field';

@Component({
  imports: [...FIELDS],
  template: `
    <app-field label="Supplier invoice" hint="As printed on the invoice" [error]="error()">
      <input id="given" class="input" />
    </app-field>
    <app-field label="Note"><textarea class="input"></textarea></app-field>
    <div class="field">
      <label>Quantity</label>
      <input class="input" type="number" aria-describedby="page-own" />
      <span class="hint">Negative removes stock</span>
      @if (error()) {
        <span class="error">{{ error() }}</span>
      }
    </div>
    <table class="table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Quantity</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Amoxicillin 500 mg <small>Batch &amp; expiry</small></td>
          <td><input class="qty" /></td>
          <td><input class="named" aria-label="Unit cost" /></td>
        </tr>
      </tbody>
    </table>
  `,
})
class Host {
  readonly error = signal<string | null>(null);
}

describe('Field', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('ties the label to its control, keeping an id the page gave', async () => {
    const { root } = await render();
    const [invoice, note] = Array.from(root.querySelectorAll('app-field'));
    expect(invoice.querySelector('label')!.htmlFor).toBe('given');
    const textarea = note.querySelector('textarea')!;
    expect(textarea.id).toBeTruthy();
    expect(note.querySelector('label')!.htmlFor).toBe(textarea.id);
    expect(invoice.classList.contains('field')).toBe(true);
  });

  it('describes the control by its hint and its error, and marks it invalid while the error shows', async () => {
    const { fixture, root } = await render();
    const input = root.querySelector<HTMLInputElement>('#given')!;
    const hint = root.querySelector('app-field .hint')!;
    expect(input.getAttribute('aria-describedby')).toBe(hint.id);
    expect(input.hasAttribute('aria-invalid')).toBe(false);

    fixture.componentInstance.error.set('Required');
    await fixture.whenStable();
    const error = root.querySelector('app-field .error')!;
    expect(input.getAttribute('aria-describedby')).toBe(`${hint.id} ${error.id}`);
    expect(input.getAttribute('aria-invalid')).toBe('true');

    fixture.componentInstance.error.set(null);
    await fixture.whenStable();
    expect(input.getAttribute('aria-describedby')).toBe(hint.id);
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });

  it('links an existing .field block the same way, keeping what the page described', async () => {
    const { fixture, root } = await render();
    const block = root.querySelector('div.field')!;
    const input = block.querySelector('input')!;
    expect(block.querySelector('label')!.htmlFor).toBe(input.id);
    const hint = block.querySelector('.hint')!;
    expect(input.getAttribute('aria-describedby')).toBe(`page-own ${hint.id}`);

    fixture.componentInstance.error.set('Too many');
    await fixture.whenStable();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(
      block.querySelector('.error')!.id,
    );
  });

  it('names the unnamed inputs of a table row by column and row', async () => {
    const { root } = await render();
    expect(root.querySelector('.qty')!.getAttribute('aria-label')).toBe(
      'Quantity — Amoxicillin 500 mg Batch & expiry',
    );
    expect(root.querySelector('.named')!.getAttribute('aria-label')).toBe('Unit cost');
  });
});
