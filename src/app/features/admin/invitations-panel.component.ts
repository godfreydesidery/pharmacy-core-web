import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/api/api-error';
import { Api } from '../../core/api/api.service';
import { Branch, Role } from '../../core/api/models';
import { Invitation } from '../../core/api/security.models';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { IconComponent } from '../../core/ui/icon.component';
import { ModalComponent } from '../../core/ui/overlay.components';
import { ToastService } from '../../core/ui/toast.service';
import { StatusBadgeComponent } from '../../core/ui/widgets';
import { Translations } from '../../core/i18n/translations.store';

/**
 * Invitations by email: the invitee chooses their own password from the link (valid 7 days), so
 * nobody else ever knows it. Lists pending and past invitations, with revoke.
 */
@Component({
  selector: 'app-invitations-panel',
  imports: [
    TranslatePipe,
    ReactiveFormsModule,
    IconComponent,
    ModalComponent,
    StatusBadgeComponent,
    DatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card invitations">
      <div class="card-head">
        <div>
          <h3>{{ 'admin.invitations' | t }}</h3>
          <p class="muted">{{ 'admin.peopleInvitedByEmailWho' | t }}</p>
        </div>
        <div class="chips">
          <button
            type="button"
            class="chip"
            [class.active]="!showAll()"
            (click)="showAll.set(false)"
          >
            {{ 'ui.invites.pending' | t }}
          </button>
          <button type="button" class="chip" [class.active]="showAll()" (click)="showAll.set(true)">
            {{ 'ui.invites.all' | t }}
          </button>
        </div>
        <button class="btn primary" type="button" (click)="openInvite()">
          <app-icon name="mail" [size]="16" /> {{ 'admin.inviteByEmail' | t }}
        </button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>{{ 'admin.invitee' | t }}</th>
              <th>{{ 'admin.role' | t }}</th>
              <th>{{ 'admin.status' | t }}</th>
              <th>{{ 'admin.invitedBy' | t }}</th>
              <th>{{ 'admin.expires' | t }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (invitation of shown(); track invitation.uid) {
              <tr>
                <td>
                  <b>{{ invitation.name }}</b>
                  <div class="muted small">{{ invitation.email }}</div>
                  @if (invitation.acceptedAs && invitation.acceptedAs !== invitation.email) {
                    <div class="small accepted-as">
                      {{ 'join.acceptedAs' | t: { who: invitation.acceptedAs } }}
                    </div>
                  }
                </td>
                <td>{{ invitation.roleName }}</td>
                <td><app-status [value]="invitation.status" /></td>
                <td>{{ invitation.invitedBy }}</td>
                <td>{{ invitation.expiresAt | date: 'medium' }}</td>
                <td class="right">
                  @if (invitation.status === 'PENDING') {
                    <button class="btn sm" type="button" (click)="revoke(invitation)">
                      {{ 'admin.revoke' | t }}
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="muted center">{{ 'admin.noInvitationsYet' | t }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <app-modal [open]="open()" [title]="'admin.inviteByEmail' | t" (closed)="open.set(false)">
      <form class="form-grid" [formGroup]="form" (ngSubmit)="invite()">
        <div class="field">
          <label for="invite-name">{{ 'admin.name' | t }}</label>
          <input id="invite-name" class="input" formControlName="name" />
          @if (err('name'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field">
          <label for="invite-email">{{ 'admin.email' | t }}</label>
          <input id="invite-email" class="input" type="email" formControlName="email" />
          @if (err('email'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field full">
          <label for="invite-role">{{ 'admin.role' | t }}</label>
          <select id="invite-role" class="input" formControlName="roleUid">
            @for (role of roles(); track role.uid) {
              <option [value]="role.uid">{{ role.name }}</option>
            }
          </select>
        </div>
        <label class="check full">
          <input type="checkbox" formControlName="allBranches" /> {{ 'admin.everyBranch' | t }}
        </label>
        @if (!form.controls.allBranches.value) {
          <div class="field full branches">
            @for (branch of branches(); track branch.uid) {
              <label class="check">
                <input
                  type="checkbox"
                  [checked]="selected().has(branch.uid)"
                  (change)="toggle(branch.uid)"
                />
                {{ branch.name }} <span class="muted">{{ branch.code }}</span>
              </label>
            }
          </div>
        }
        <div class="actions full">
          <button class="btn" type="button" (click)="open.set(false)">
            {{ 'common.cancel' | t }}
          </button>
          <button class="btn primary" type="submit" [disabled]="busy()">
            <app-icon name="mail" [size]="16" /> {{ 'admin.sendInvitation' | t }}
          </button>
        </div>
      </form>
    </app-modal>
  `,
  styles: `
    .invitations {
      margin-top: 18px;
    }
    .accepted-as {
      color: var(--green);
    }
    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 16px 18px;
    }
    .small {
      font-size: 12px;
    }
    .center {
      text-align: center;
      padding: 24px;
    }
    .right {
      text-align: right;
    }
    .check {
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: 13.5px;
    }
    .branches {
      display: grid;
      gap: 6px;
    }
  `,
})
export class InvitationsPanelComponent implements OnInit {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);

  private readonly translations = inject(Translations);
  protected readonly invitations = signal<Invitation[]>([]);
  /** Pending invitations by default; accepted, revoked and expired ones on request. */
  protected readonly showAll = signal(false);
  protected readonly shown = computed(() =>
    this.showAll() ? this.invitations() : this.invitations().filter((i) => i.status === 'PENDING'),
  );
  protected readonly roles = signal<Role[]>([]);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly selected = signal(new Set<string>());
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    roleUid: ['', Validators.required],
    allBranches: [true],
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  /** Re-reads the invitations, e.g. after the users page sent one. */
  reload(): Promise<void> {
    return this.load();
  }

  protected err(name: 'name' | 'email'): string | null {
    return controlError(this.form.controls[name]);
  }

  protected async openInvite(): Promise<void> {
    if (!this.roles().length) {
      const [roles, branches] = await Promise.all([
        this.api.get<Role[]>('/roles', undefined, { noBranch: true }),
        this.api.get<Branch[]>('/branches', undefined, { noBranch: true }),
      ]);
      this.roles.set(roles);
      this.branches.set(branches.filter((branch) => branch.active));
    }
    this.form.reset({
      name: '',
      email: '',
      roleUid:
        this.roles().find((role) => role.code === 'CASHIER')?.uid ?? this.roles()[0]?.uid ?? '',
      allBranches: true,
    });
    this.selected.set(new Set());
    this.open.set(true);
  }

  protected toggle(uid: string): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (!next.delete(uid)) {
        next.add(uid);
      }
      return next;
    });
  }

  protected async invite(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    this.busy.set(true);
    try {
      const value = this.form.getRawValue();
      await this.api.post(
        '/users/invitations',
        { ...value, branchUids: value.allBranches ? [] : [...this.selected()] },
        { silent: true, noBranch: true },
      );
      this.toasts.success(this.translations.t('toast.invitationSent', { email: value.email }));
      this.open.set(false);
      await this.load();
    } catch (failure) {
      if (!applyApiError(this.form, failure)) {
        this.toasts.error(ApiError.from(failure).message);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async revoke(invitation: Invitation): Promise<void> {
    try {
      await this.api.delete(`/users/invitations/${invitation.uid}`, { noBranch: true });
      this.toasts.success(this.translations.t('toast.invitationRevoked'));
      await this.load();
    } catch {
      /* the interceptor showed the problem */
    }
  }

  private async load(): Promise<void> {
    try {
      this.invitations.set(
        await this.api.get<Invitation[]>('/users/invitations', undefined, {
          silent: true,
          noBranch: true,
        }),
      );
    } catch {
      this.invitations.set([]);
    }
  }
}
