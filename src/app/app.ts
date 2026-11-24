import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IdleWatch } from './core/session/idle';
import { LookService } from './core/ui/look.service';
import { ThemeService } from './core/ui/theme.service';
import { ConfirmDialogComponent } from './core/ui/confirm';
import { ConfirmIdentityComponent } from './core/session/confirm-identity';
import { ManagerApprovalComponent } from './core/session/manager-approval';
import { OpenShiftComponent } from './core/session/open-shift';
import { ToasterComponent } from './core/ui/widgets';
import { LoadingBarComponent } from './core/layout/loading';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    ToasterComponent,
    ConfirmDialogComponent,
    ConfirmIdentityComponent,
    ManagerApprovalComponent,
    OpenShiftComponent,
    LoadingBarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-loading-bar /><router-outlet /><app-toaster /><app-confirm /><app-confirm-identity /><app-manager-approval /><app-open-shift />`,
})
export class App {
  /** Created here so the saved theme applies before any page renders. */
  protected readonly theme = inject(ThemeService);
  /** Likewise the pharmacy's look (premium or classic), remembered from the last visit. */
  protected readonly look = inject(LookService);
  /** Signs out after the pharmacy's inactivity limit, on every page while signed in. */
  protected readonly idle = inject(IdleWatch);
}
