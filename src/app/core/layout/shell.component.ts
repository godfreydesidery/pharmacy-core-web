import {
  ChangeDetectionStrategy,
  DestroyRef,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Api } from '../api/api.service';
import { TenantLogoStore } from '../files/tenant-logo.store';
import { SettingsStore } from '../format/settings.store';
import { SubscriptionStore } from '../subscription/subscription.store';
import { LanguageSwitchComponent } from '../i18n/language-switch.component';
import { BellComponent } from '../notifications/bell.component';
import { TranslatePipe } from '../i18n/t.pipe';
import { Translations } from '../i18n/translations.store';
import { LeaveGuard } from '../session/leave-guard';
import { SessionStore } from '../session/session.store';
import { IconComponent } from '../ui/icon.component';
import { LookService } from '../ui/look.service';
import { ThemeService } from '../ui/theme.service';
import { ToastService } from '../ui/toast.service';
import { LogoComponent } from './logo.component';
import { NavItem, PLATFORM_NAV, TENANT_NAV } from './nav';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    IconComponent,
    LogoComponent,
    TranslatePipe,
    LanguageSwitchComponent,
    BellComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  host: {
    '[class.collapsed]': 'collapsed()',
    '[class.mobile-open]': 'mobileOpen()',
    '(document:click)': 'closeFlyout($event)',
    '(document:keydown.escape)': 'flyout.set(null)',
  },
})
export class ShellComponent {
  protected readonly session = inject(SessionStore);
  protected readonly theme = inject(ThemeService);
  /** The classic look has no dark mode, so the theme switch hides. */
  protected readonly look = inject(LookService);
  protected readonly logo = inject(TenantLogoStore);
  private readonly settings = inject(SettingsStore);
  protected readonly subscription = inject(SubscriptionStore);
  private readonly router = inject(Router);
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly leave = inject(LeaveGuard);

  protected readonly collapsed = signal(false);
  protected readonly mobileOpen = signal(false);
  protected readonly userMenu = signal(false);
  private readonly openGroups = signal<Set<string>>(new Set());
  /** The group whose links float beside the collapsed sidebar, anchored to its icon. */
  protected readonly flyout = signal<{
    id: string;
    top: number | null;
    bottom: number | null;
  } | null>(null);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly platformNav = computed(() => (this.session.isRoot() ? PLATFORM_NAV : []));
  /** A suspended pharmacy, for anyone but a root administrator: only the account page stays open. */
  protected readonly suspendedForMe = computed(
    () => this.session.tenant()?.status === 'SUSPENDED' && !this.session.isRoot(),
  );
  protected readonly blockedBySuspension = computed(
    () => this.suspendedForMe() && !this.url().startsWith('/account'),
  );

  protected readonly tenantNav = computed<NavItem[]>(() => {
    if (!this.session.tenant() || this.suspendedForMe()) {
      return [];
    }
    // The subscription plan hides modules it lacks (never from a root administrator).
    const allows = (feature?: NavItem['feature']) =>
      this.session.isRoot() || this.subscription.allows(feature);
    return TENANT_NAV.filter((item) => allows(item.feature))
      .map((item) =>
        item.children
          ? {
              ...item,
              children: item.children.filter(
                (c) => this.session.can(c.permission) && allows(c.feature),
              ),
            }
          : item,
      )
      .filter((item) =>
        item.children ? item.children.length > 0 : this.session.can(item.permission),
      );
  });

  protected readonly initials = computed(() =>
    (this.session.user()?.name ?? '?')
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
  );

  constructor() {
    // Leaving the signed-in app (signing out) goes back to the premium look.
    inject(DestroyRef).onDestroy(() => this.look.reset());
    effect(() => {
      const tenant = this.session.tenant();
      // A suspended pharmacy refuses every read but the root administrator's.
      const readable = tenant && !this.suspendedForMe() ? tenant : null;
      if (readable) {
        void this.settings.load(readable.uid);
        void this.subscription.load(readable.uid);
      } else {
        this.settings.clear();
        this.subscription.clear();
      }
      void this.logo.load(readable?.uid ?? null);
    });
    // The free trial is a notice, not a bar: a toast once per pharmacy per browser session.
    effect(() => {
      const tenant = this.session.tenant();
      const sub = this.subscription.status();
      const days = this.subscription.trialDaysLeft();
      if (!tenant || this.suspendedForMe() || sub?.status !== 'TRIAL' || days === null) {
        return;
      }
      untracked(() => this.announceTrial(tenant.uid, sub.planName, days));
    });
    effect(() => {
      const url = this.url();
      const group = TENANT_NAV.find((item) =>
        item.children?.some((child) => url.startsWith(child.path)),
      );
      // One group open at a time: the current page's (none for a page outside the groups).
      this.openGroups.set(group ? new Set([group.id]) : new Set());
      this.mobileOpen.set(false);
      this.userMenu.set(false);
      this.flyout.set(null);
    });
  }

  private announceTrial(tenantUid: string, plan: string, days: number): void {
    const key = 'pc.trialNotice.' + tenantUid;
    try {
      if (sessionStorage.getItem(key)) {
        return;
      }
      sessionStorage.setItem(key, '1');
    } catch {
      /* without storage it may show again on reload */
    }
    const canManage = this.session.can('settings.manage');
    const text = this.translations.t('plans.banner.trial', { days, plan });
    this.toast.info(
      canManage ? text + ' ' + this.translations.t('plans.banner.see') + ' →' : text,
      { ttl: 8000, link: canManage ? '/admin/subscription' : undefined },
    );
  }

  /** Expanded: open or close the group in place. Collapsed: float its links beside the icon. */
  protected onGroup(item: NavItem, button: HTMLElement): void {
    if (!this.collapsed() || window.matchMedia('(max-width: 1024px)').matches) {
      this.toggleGroup(item.id);
      return;
    }
    if (this.flyout()?.id === item.id) {
      this.flyout.set(null);
      return;
    }
    const rect = button.getBoundingClientRect();
    const lowerHalf = rect.top > window.innerHeight / 2;
    this.flyout.set({
      id: item.id,
      top: lowerHalf ? null : rect.top,
      bottom: lowerHalf ? window.innerHeight - rect.bottom : null,
    });
  }

  protected closeFlyout(event: Event): void {
    if (this.flyout() && !(event.target as Element | null)?.closest?.('.group')) {
      this.flyout.set(null);
    }
  }

  /** The i18n key of a sidebar link: `/sales/returns` → `nav.sales.returns`, `/sales` → `nav.sales.history`. */
  protected navKey(path: string): string {
    const key = 'nav' + path.replace(/\//g, '.');
    return path.split('/').length === 2 &&
      TENANT_NAV.some((i) => i.children?.some((c) => c.path === path))
      ? `${key}.history`
      : key;
  }

  protected isOpen(id: string): boolean {
    return this.openGroups().has(id);
  }

  protected isGroupActive(item: NavItem): boolean {
    return !!item.children?.some((child) => this.url().startsWith(child.path));
  }

  /** Opening a group closes the others (an accordion); clicking an open group closes it. */
  protected toggleGroup(id: string): void {
    this.openGroups.update((open) => (open.has(id) ? new Set() : new Set([id])));
  }

  protected toggleMenu(): void {
    if (window.matchMedia('(max-width: 1024px)').matches) {
      this.mobileOpen.update((open) => !open);
    } else {
      this.collapsed.update((value) => !value);
      this.flyout.set(null);
    }
  }

  protected async switchBranch(uid: string, select?: HTMLSelectElement): Promise<void> {
    if (!(await this.leave.canLeave())) {
      // Stayed: the selector goes back to the branch still in use.
      if (select) {
        select.value = this.session.branch()?.uid ?? '';
      }
      return;
    }
    const branch = this.session.branches().find((b) => b.uid === uid) ?? null;
    this.session.switchBranch(branch);
    void this.router.navigateByUrl(this.router.url);
  }

  protected async signOut(): Promise<void> {
    this.userMenu.set(false);
    if (!(await this.leave.canLeave())) {
      return;
    }
    try {
      await this.api.post('/auth/sign-out', {}, { silent: true });
    } catch {
      /* the session is dropped locally either way */
    }
    this.session.signOut();
    await this.router.navigate(['/sign-in']);
  }
}
