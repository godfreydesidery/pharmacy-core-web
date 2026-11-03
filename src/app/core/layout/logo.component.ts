import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The Pharmacy Core mark: a blue and teal cross. */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:inline-flex' },
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 40 40" aria-hidden="true">
      <rect x="13" y="3" width="14" height="34" rx="5" [attr.fill]="light() ? '#fff' : '#2463eb'" />
      <rect
        x="3"
        y="13"
        width="34"
        height="14"
        rx="5"
        [attr.fill]="light() ? '#bae6fd' : '#22b8cf'"
        opacity=".92"
      />
      <rect x="13" y="13" width="14" height="14" [attr.fill]="light() ? '#e0f2fe' : '#1d4ed8'" />
      <path
        d="M17 20h6M20 17v6"
        [attr.stroke]="light() ? '#1d4ed8' : '#fff'"
        stroke-width="2.4"
        stroke-linecap="round"
      />
    </svg>
  `,
})
export class LogoComponent {
  readonly size = input(36);
  readonly light = input(false);
}
