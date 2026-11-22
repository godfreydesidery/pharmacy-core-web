import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Category, Product } from '../../core/api/models';
import { debounced, loaded, pagedList } from '../../core/data/data';
import { downloadCsv } from '../../core/format/format';
import { SHARED } from '../../core/shared';
import { PRODUCT_TYPES, productTypeOf } from '../../core/ui/product-types';
import { SessionStore } from '../../core/session/session.store';
import { TranslatePipe } from '../../core/i18n/t.pipe';

@Component({
  selector: 'app-products',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'catalogue.products' | t }}</h1>
          <p class="sub">{{ 'catalogue.thePharmacySCatalogueSharedBy' | t }}</p>
        </div>
        <div class="actions">
          <button class="btn" type="button" (click)="export()">
            <app-icon name="download" [size]="16" /> {{ 'catalogue.export' | t }}
          </button>
          @if (session.can('catalogue.manage')) {
            <a class="btn primary" routerLink="new"
              ><app-icon name="plus" [size]="16" /> {{ 'catalogue.addProduct' | t }}</a
            >
          }
        </div>
      </div>
      <div class="card">
        <div class="toolbar">
          <label class="search"
            ><app-icon name="search" [size]="16" /><input
              [placeholder]="'catalogue.nameGenericBrandSkuOrGtin' | t"
              (input)="q.set($any($event.target).value)"
          /></label>
          @if (categories.value(); as cats) {
            <select
              class="select"
              style="width:auto"
              (change)="categoryUid.set($any($event.target).value)"
            >
              <option value="">{{ 'catalogue.allCategories' | t }}</option>
              @for (c of cats; track c.uid) {
                <option [value]="c.uid">{{ c.path }}</option>
              }
            </select>
          }
          <div
            class="chips type-chips"
            role="group"
            [attr.aria-label]="'catalogue.productType' | t"
          >
            <button
              type="button"
              class="chip"
              [class.active]="!productType()"
              (click)="productType.set('')"
            >
              {{ 'catalogue.all' | t }}
            </button>
            @for (t of types; track t.code) {
              <button
                type="button"
                class="chip"
                [class.on]="productType() === t.code"
                (click)="productType.set(t.code)"
              >
                <app-icon [name]="t.icon" [size]="14" />
                {{ 'ui.ptype.' + t.code | t: null : t.label }}
              </button>
            }
          </div>
          <select
            class="select"
            style="width:auto"
            (change)="active.set($any($event.target).value)"
          >
            <option value="">{{ 'catalogue.activeAndInactive' | t }}</option>
            <option value="true">{{ 'catalogue.active' | t }}</option>
            <option value="false">{{ 'catalogue.inactive' | t }}</option>
          </select>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'catalogue.product' | t }}</th>
                <th>{{ 'catalogue.category' | t }}</th>
                <th>{{ 'catalogue.formModel' | t }}</th>
                <th>{{ 'catalogue.manufacturer' | t }}</th>
                <th>{{ 'catalogue.schedule' | t }}</th>
                <th class="right">{{ 'catalogue.cost' | t }}</th>
                <th class="right">{{ 'catalogue.price' | t }}</th>
                <th class="right">{{ 'catalogue.margin' | t }}</th>
                <th>{{ 'catalogue.status' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (p of list.items(); track p.uid) {
                <tr class="clickable" [routerLink]="[p.uid]">
                  <td>
                    <div class="cell-main">
                      <span
                        class="thumb tone-{{ typeOf(p).tone }}"
                        [title]="'ui.ptype.' + typeOf(p).code | t: null : typeOf(p).label"
                        ><app-icon [name]="typeOf(p).icon" [size]="16"
                      /></span>
                      <div>
                        <b>{{ p.name }}</b
                        ><small
                          >{{ p.genericName ?? p.brand ?? '' }}{{ p.sku ? ' · ' + p.sku : ''
                          }}{{ p.atcCode ? ' · ' + p.atcCode : '' }}</small
                        >
                      </div>
                      @if (p.trackingMode === 'SERIAL') {
                        <span class="badge purple" [title]="'catalogue.trackedBySerialNumber' | t"
                          >S/N</span
                        >
                      }
                    </div>
                  </td>
                  <td>{{ p.categoryName ?? '—' }}</td>
                  <td class="muted">
                    @if (p.productType === 'MEDICINE' || !p.productType) {
                      {{ p.dosageForm | label }}{{ p.strength ? ' · ' + p.strength : '' }}
                    } @else {
                      {{ p.model ?? (p.unitOfMeasure | label)
                      }}{{
                        p.warrantyMonths
                          ? ' · ' + p.warrantyMonths + ('ui.l.preMoWarranty' | t)
                          : ''
                      }}
                    }
                  </td>
                  <td>{{ p.manufacturerName ?? '—' }}</td>
                  <td><app-status [value]="p.schedule" /></td>
                  <td class="right">{{ p.costPrice | money }}</td>
                  <td class="right strong">{{ p.sellingPrice | money }}</td>
                  <td class="right">{{ margin(p) }}</td>
                  <td><app-status [value]="p.active ? 'ACTIVE' : 'INACTIVE'" /></td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="9">
                    <app-empty
                      [loading]="list.loading()"
                      icon="pill"
                      [title]="'catalogue.noProducts' | t"
                      [text]="'ui.empty.products' | t"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager
          [count]="list.items().length"
          [total]="list.total()"
          [hasMore]="list.hasMore()"
          [loading]="list.loading()"
          (more)="list.more()"
        />
      </div>
    </div>
  `,
})
export default class ProductsPage {
  protected readonly session = inject(SessionStore);
  protected readonly q = signal('');
  protected readonly categoryUid = signal('');
  protected readonly active = signal('');
  protected readonly productType = signal('');
  protected readonly types = PRODUCT_TYPES;
  private readonly query = debounced(this.q);
  protected readonly categories = loaded<Category[]>(() => ({
    path: '/categories',
    options: { noBranch: true },
  }));
  protected readonly list = pagedList<Product>(() => ({
    path: '/products',
    query: {
      q: this.query(),
      categoryUid: this.categoryUid(),
      active: this.active(),
      productType: this.productType(),
    },
    options: { noBranch: true },
  }));

  protected typeOf(p: Product) {
    return productTypeOf(p.productType);
  }

  protected margin(p: Product): string {
    return p.sellingPrice > 0
      ? `${Math.round(((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100)}%`
      : '—';
  }

  protected export(): void {
    downloadCsv(
      'products.csv',
      [
        'Name',
        'Type',
        'Generic',
        'SKU',
        'GTIN',
        'ATC',
        'Category',
        'Form',
        'Strength',
        'Dispensing class',
        'Cost',
        'Price',
        'Reorder',
        'Active',
      ],
      this.list
        .items()
        .map((p) => [
          p.name,
          p.productType,
          p.genericName,
          p.sku,
          p.gtin,
          p.atcCode,
          p.categoryName,
          p.dosageForm,
          p.strength,
          p.schedule,
          p.costPrice,
          p.sellingPrice,
          p.reorderLevel,
          String(p.active),
        ]),
    );
  }
}
