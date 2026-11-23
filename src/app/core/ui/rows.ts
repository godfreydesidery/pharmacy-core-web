import { Directive, ElementRef, inject } from '@angular/core';

/** What already answers a click itself, inside a row. */
const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"]';

/**
 * A table row that opens something, usable with the keyboard as well as the mouse (WCAG 2.1.1):
 * the row's main cell holds the real link or button, marked `row-link`, which Tab reaches and
 * Enter opens; a click anywhere else on the row clicks it.
 *
 * ```html
 * <tr class="clickable" appRowLink>
 *   <td><a class="row-link" [routerLink]="[sale.uid]">{{ sale.number }}</a></td>
 * ```
 *
 * A row whose own `(click)` opens it needs only a `<button type="button" class="row-link">` in
 * its main cell: the button's click (or Enter) reaches the row's handler.
 */
@Directive({ selector: 'tr[appRowLink]', host: { '(click)': 'click($event)' } })
export class RowLinkDirective {
  private readonly row: HTMLTableRowElement = inject(ElementRef).nativeElement;

  protected click(event: MouseEvent): void {
    const target = event.target as Element | null;
    if (target?.closest(INTERACTIVE) || window.getSelection()?.toString()) {
      return; // a control of its own, or text being selected
    }
    this.row.querySelector<HTMLElement>('.row-link')?.click();
  }
}
