import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import { Category } from '../../core/api/models';
import { loaded } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';

/** A category in the tree: its depth (0 at the top) and whether it has sub-categories. */
interface TreeRow {
  category: Category;
  depth: number;
  children: number;
}

const MAX_DEPTH = 3;

/** The category tree: medicines, equipment, supplies and so on, at most three levels deep. */
@Component({
  selector: 'app-categories',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'catalogue.categories' | t }}</h1>
          <p class="sub">
            {{ 'catalogue.aTreeOfGroupsMedicinesAnalgesics' | t }}
          </p>
        </div>
        <div class="actions">
          @if (session.can('catalogue.manage')) {
            <button class="btn primary" type="button" (click)="edit(null, null)">
              <app-icon name="plus" [size]="16" /> {{ 'catalogue.addCategory' | t }}
            </button>
          }
        </div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'catalogue.category' | t }}</th>
                <th>{{ 'catalogue.description' | t }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of tree(); track row.category.uid) {
                <tr>
                  <td>
                    <div class="cell-main" [style.padding-left.px]="row.depth * 26">
                      @if (row.depth > 0) {
                        <span class="branch" aria-hidden="true">└</span>
                      }
                      <span class="thumb" [class]="'thumb ' + tone(row.depth)"
                        ><app-icon [name]="row.depth === 0 ? 'layers' : 'grid'" [size]="15"
                      /></span>
                      <div>
                        <b>{{ row.category.name }}</b>
                        @if (row.children) {
                          <small>{{ 'ui.t.subCategories' | t: { count: row.children } }}</small>
                        }
                      </div>
                    </div>
                  </td>
                  <td class="muted" style="white-space:normal">
                    {{ row.category.description ?? '—' }}
                  </td>
                  <td class="right nowrap">
                    @if (session.can('catalogue.manage')) {
                      @if (row.depth < maxDepth - 1) {
                        <button
                          class="btn sm ghost"
                          type="button"
                          (click)="edit(null, row.category.uid)"
                          [attr.aria-label]="('ui.l.addASubCategoryOfSp' | t) + row.category.name"
                        >
                          <app-icon name="plus" [size]="14" /> {{ 'catalogue.subCategory' | t }}
                        </button>
                      }
                      <button class="btn sm" type="button" (click)="edit(row.category, null)">
                        <app-icon name="edit" [size]="14" /> {{ 'catalogue.edit' | t }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3">
                    <app-empty [for]="list" icon="layers" [title]="'catalogue.noCategories' | t" />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <app-modal
      [open]="open()"
      [title]="current() ? ('ui.l.editCategory' | t) : ('ui.l.addCategory' | t)"
      (closed)="open.set(false)"
    >
      <form class="stack" [formGroup]="form" (ngSubmit)="save()">
        <div class="field">
          <label>{{ 'catalogue.name' | t }}</label
          ><input class="input" formControlName="name" />
          @if (err('name'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field">
          <label>{{ 'catalogue.parent' | t }}</label>
          <select class="select" formControlName="parentUid">
            <option value="">{{ 'catalogue.topLevel' | t }}</option>
            @for (row of parents(); track row.category.uid) {
              <option [value]="row.category.uid">{{ row.category.path }}</option>
            }
          </select>
          @if (err('parentUid'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field">
          <label>{{ 'catalogue.description' | t }}</label
          ><textarea class="input" formControlName="description"></textarea>
        </div>
      </form>
      <ng-container footer>
        <button class="btn" type="button" (click)="open.set(false)">
          {{ 'catalogue.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="save()">
          {{ 'catalogue.save' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .branch {
      color: var(--faint, var(--muted));
      margin-right: 2px;
    }
    .nowrap {
      white-space: nowrap;
    }
    .cell-main small {
      display: block;
      color: var(--muted);
      font-size: 11.5px;
    }
  `,
})
export default class CategoriesPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly maxDepth = MAX_DEPTH;
  protected readonly list = loaded<Category[]>(() => ({
    path: '/categories',
    options: { noBranch: true },
  }));
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly current = signal<Category | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    parentUid: [''],
    description: [''],
  });

  /** Parents before their children, each child under its parent, siblings by name. */
  protected readonly tree = computed<TreeRow[]>(() => {
    const all = this.list.value() ?? [];
    const byParent = new Map<string | null, Category[]>();
    for (const c of all) {
      const key = c.parentUid ?? null;
      byParent.set(key, [...(byParent.get(key) ?? []), c]);
    }
    const rows: TreeRow[] = [];
    const walk = (parent: string | null, depth: number) => {
      for (const c of [...(byParent.get(parent) ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name),
      )) {
        rows.push({ category: c, depth, children: byParent.get(c.uid)?.length ?? 0 });
        walk(c.uid, depth + 1);
      }
    };
    walk(null, 0);
    return rows;
  });

  /** Where a category may go: not under itself or its own sub-categories, never too deep. */
  protected readonly parents = computed(() => {
    const moving = this.current();
    const rows = this.tree();
    const excluded = new Set<string>();
    if (moving) {
      excluded.add(moving.uid);
      let grew = true;
      while (grew) {
        grew = false;
        for (const r of rows) {
          if (
            r.category.parentUid &&
            excluded.has(r.category.parentUid) &&
            !excluded.has(r.category.uid)
          ) {
            excluded.add(r.category.uid);
            grew = true;
          }
        }
      }
    }
    return rows.filter((r) => r.depth < MAX_DEPTH - 1 && !excluded.has(r.category.uid));
  });

  protected tone(depth: number): string {
    return ['tone-purple', 'tone-blue', 'tone-green'][depth] ?? 'tone-gray';
  }

  protected err(name: string): string | null {
    return controlError(this.form.get(name));
  }

  protected edit(category: Category | null, parentUid: string | null): void {
    this.current.set(category);
    this.form.reset({
      name: category?.name ?? '',
      parentUid: category?.parentUid ?? parentUid ?? '',
      description: category?.description ?? '',
    });
    this.open.set(true);
  }

  protected async save(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    const v = this.form.getRawValue();
    const body = {
      name: v.name,
      description: v.description || null,
      parentUid: v.parentUid || null,
    };
    const current = this.current();
    this.busy.set(true);
    try {
      if (current) {
        await this.api.put(`/categories/${current.uid}`, body, { silent: true, noBranch: true });
      } else {
        await this.api.post('/categories', body, { silent: true, noBranch: true });
      }
      this.toasts.success(this.translations.t('toast.categorySaved'));
      this.open.set(false);
      await this.list.reload();
    } catch (failure) {
      if (!applyApiError(this.form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
