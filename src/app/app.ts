import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LookService } from './core/ui/look.service';
import { ThemeService } from './core/ui/theme.service';
import { ToasterComponent } from './core/ui/widgets';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToasterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet /><app-toaster />`,
})
export class App {
  /** Created here so the saved theme applies before any page renders. */
  protected readonly theme = inject(ThemeService);
  /** Likewise the pharmacy's look (premium or classic), remembered from the last visit. */
  protected readonly look = inject(LookService);
}
