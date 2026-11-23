import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ElementRef,
  afterEveryRender,
  inject,
  input,
} from '@angular/core';
import { uniqueId } from './dialog';

/** The controls a field label can name. */
const CONTROL = 'input:not([type="hidden"]), select, textarea';
/** The ids a field put in a control's aria-describedby, so it can change them later. */
const OWN_DESCRIBED = 'data-field-described';
/** Set while aria-invalid is the field's doing, not a binding of the page's. */
const OWN_INVALID = 'data-field-invalid';

function idOf(element: HTMLElement, prefix: string): string {
  if (!element.id) {
    element.id = uniqueId(prefix);
  }
  return element.id;
}

/**
 * Ties one form field together (WCAG 1.3.1, 3.3.1, 4.1.2): the label names its control (`for` and
 * `id`), the hint and the error describe it (`aria-describedby`), and the control says it is
 * invalid (`aria-invalid`) while an error shows or it is touched and invalid. The field is the
 * element around a `<label>`, its control (an input, a select, a textarea, or a component holding
 * one, such as `app-lookup`), an optional `.hint` and an optional `.error`. Runs after each render,
 * so a control or message that appears later is linked too. Ids and attributes the page set itself
 * are kept.
 */
export function linkField(field: HTMLElement): void {
  const label = Array.from(field.children).find(
    (child): child is HTMLLabelElement => child instanceof HTMLLabelElement,
  );
  const control = Array.from(field.querySelectorAll<HTMLElement>(CONTROL)).find(
    (candidate) => !label?.contains(candidate),
  );
  if (!control) {
    return;
  }
  if (label && !label.htmlFor && !label.querySelector(CONTROL)) {
    label.htmlFor = idOf(control, 'field');
  }

  const messages = Array.from(field.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      (child.classList.contains('hint') || child.classList.contains('error')) &&
      !!child.textContent?.trim(),
  );
  const own = messages.map((message) => idOf(message, 'field-note'));
  const before = (control.getAttribute(OWN_DESCRIBED) ?? '').split(' ').filter(Boolean);
  const others = (control.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter((id) => id && !before.includes(id));
  const describedBy = [...others, ...own.filter((id) => !others.includes(id))].join(' ');
  if (describedBy) {
    control.setAttribute('aria-describedby', describedBy);
  } else {
    control.removeAttribute('aria-describedby');
  }
  control.setAttribute(OWN_DESCRIBED, own.join(' '));

  const bound = control.hasAttribute('aria-invalid') && !control.hasAttribute(OWN_INVALID);
  if (!bound) {
    const invalid =
      messages.some((message) => message.classList.contains('error')) ||
      control.classList.contains('invalid') ||
      (control.classList.contains('ng-invalid') && control.classList.contains('ng-touched'));
    if (invalid) {
      control.setAttribute('aria-invalid', 'true');
      control.setAttribute(OWN_INVALID, '');
    } else {
      control.removeAttribute('aria-invalid');
      control.removeAttribute(OWN_INVALID);
    }
  }
}

/**
 * Names the controls in a table's body rows that have no name of their own (a quantity or cost
 * input on an order line): "column — row", from the column's header and the row's first cell,
 * such as "Quantity — Amoxicillin 500 mg".
 */
export function nameTableControls(table: HTMLTableElement): void {
  const head = table.tHead?.rows[0];
  if (!head || !table.querySelector(CONTROL)) {
    return;
  }
  for (const body of Array.from(table.tBodies)) {
    for (const row of Array.from(body.rows)) {
      const controls = Array.from(row.querySelectorAll<HTMLElement>(CONTROL));
      if (!controls.length) {
        continue;
      }
      const rowName = row.cells[0] ? plainText(row.cells[0]) : '';
      for (const control of controls) {
        if (
          control.hasAttribute('aria-label') ||
          control.hasAttribute('aria-labelledby') ||
          control.closest('label') ||
          (control.id && table.querySelector(`label[for="${CSS.escape(control.id)}"]`))
        ) {
          continue;
        }
        const cell = control.closest('td, th') as HTMLTableCellElement | null;
        const column = cell ? head.cells[cell.cellIndex]?.textContent?.trim() : '';
        const placeholder = control.getAttribute('placeholder') ?? '';
        const name = [column || placeholder, cell?.cellIndex === 0 ? '' : rowName]
          .filter(Boolean)
          .join(' — ');
        if (name) {
          control.setAttribute('aria-label', name);
        }
      }
    }
  }
}

/** An element's own words, without those of the controls in it (a select's options). */
function plainText(element: Element): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const words: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest('select, button, textarea, [aria-hidden="true"]')) {
      words.push(node.textContent ?? '');
    }
  }
  return words.join(' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/**
 * Links every `<div class="field">` the app already has, without changing its markup: see
 * {@link linkField}. New forms use {@link FieldComponent}.
 */
@Directive({ selector: '.field' })
export class FieldLinkDirective {
  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    afterEveryRender(() => linkField(element));
  }
}

/** Names the unnamed controls in the rows of every `<table class="table">`: {@link nameTableControls}. */
@Directive({ selector: 'table.table' })
export class TableControlsDirective {
  constructor() {
    const element: HTMLTableElement = inject(ElementRef).nativeElement;
    afterEveryRender(() => nameTableControls(element));
  }
}

/**
 * One form field: a label tied to its control, an optional hint and an optional error, both
 * read out with the control, and `aria-invalid` while the error shows.
 *
 * ```html
 * <app-field [label]="'purchasing.note' | t" [hint]="..." [error]="err('note')">
 *   <input class="input" formControlName="note" />
 * </app-field>
 * ```
 *
 * It looks like the `.field` blocks it replaces (the same class and styles).
 */
@Component({
  selector: 'app-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'field' },
  template: `
    <label
      >{{ label() }}
      @if (required()) {
        <span class="req" aria-hidden="true">*</span>
      }
    </label>
    <ng-content />
    @if (hint()) {
      <span class="hint">{{ hint() }}</span>
    }
    @if (error()) {
      <span class="error">{{ error() }}</span>
    }
  `,
})
export class FieldComponent {
  readonly label = input.required<string>();
  readonly hint = input<string | null | undefined>(null);
  readonly error = input<string | null | undefined>(null);
  /** Marks the label with an asterisk (the control's own `required` tells assistive technology). */
  readonly required = input(false);

  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    afterEveryRender(() => linkField(element));
  }
}

/** The field pieces, for SHARED. */
export const FIELDS = [FieldComponent, FieldLinkDirective, TableControlsDirective] as const;
