import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ProviderSettingsComponent } from '../../core/notifications/provider-settings.component';
import { TranslatePipe } from '../../core/i18n/t.pipe';

/** Platform → Message providers: the email, SMS and WhatsApp accounts every pharmacy uses by default. */
@Component({
  selector: 'app-platform-providers',
  imports: [TranslatePipe, ProviderSettingsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'providers.platformTitle' | t }}</h1>
          <p class="sub">{{ 'providers.platformSub' | t }}</p>
        </div>
      </div>
      <app-provider-settings scope="platform" />
    </div>
  `,
})
export default class PlatformProvidersPage {}
