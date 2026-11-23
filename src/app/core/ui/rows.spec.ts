import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SHARED } from '../shared';

@Component({ template: '' })
class Detail {}

@Component({
  imports: [...SHARED],
  template: `
    <table class="table">
      <tbody>
        <tr class="clickable" appRowLink>
          <td><a class="row-link" [routerLink]="['/sales', 's1']">S-0001</a></td>
          <td class="cell">12,000</td>
        </tr>
        <tr class="clickable" (click)="opened.set(opened() + 1)">
          <td><button type="button" class="row-link">GR-0001</button></td>
          <td class="cell">Supplier</td>
        </tr>
      </tbody>
    </table>
  `,
})
class Host {
  readonly opened = signal(0);
}

describe('keyboard rows', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'sales/:uid', component: Detail }])],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('puts a real link in the main cell, which Tab reaches; a click elsewhere on the row follows it', async () => {
    const { fixture, root } = await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const link = root.querySelector<HTMLAnchorElement>('a.row-link')!;
    expect(link.getAttribute('href')).toBe('/sales/s1');
    expect(link.closest('tr')!.hasAttribute('tabindex')).toBe(false);

    root.querySelector<HTMLElement>('tr[approwlink] .cell')!.click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(String(navigate.mock.calls[0][0])).toBe('/sales/s1');

    // A click on the link itself navigates once, not twice.
    link.click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it('opens a (click) row from its button: Enter on the button is a click that reaches the row', async () => {
    const { fixture, root } = await render();
    const button = root.querySelectorAll<HTMLButtonElement>('button.row-link')[0];
    button.focus();
    expect(document.activeElement).toBe(button);
    button.click();
    expect(fixture.componentInstance.opened()).toBe(1);
    (root.querySelectorAll('.cell')[1] as HTMLElement).click();
    expect(fixture.componentInstance.opened()).toBe(2);
  });
});
