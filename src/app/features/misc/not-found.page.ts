import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SHARED } from '../../core/shared';

/** Shown for an address that matches no page, with a way back. */
@Component({
  selector: 'app-not-found',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="card card-pad empty not-found">
        <app-icon name="search" [size]="40" [stroke]="1.4" />
        <h1>{{ 'ui.notFound.title' | t }}</h1>
        <span>{{ 'ui.notFound.body' | t }}</span>
        <div class="row">
          <button class="btn" type="button" (click)="back()">
            <app-icon name="arrow-left" [size]="16" /> {{ 'ui.notFound.back' | t }}
          </button>
          <a class="btn primary" routerLink="/">{{ 'ui.notFound.home' | t }}</a>
        </div>
      </div>
    </div>
  `,
  styles: `
    .not-found {
      max-width: 520px;
      margin: 48px auto;
      gap: 10px;
    }
    .not-found h1 {
      font-size: 22px;
      margin: 0;
    }
    .not-found .row {
      justify-content: center;
      margin-top: 8px;
    }
  `,
})
export default class NotFoundPage {
  private readonly location = inject(Location);

  protected back(): void {
    this.location.back();
  }
}
