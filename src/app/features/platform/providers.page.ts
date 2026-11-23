import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  ProviderChannel,
  ProviderSettingsComponent,
} from '../../core/notifications/provider-settings.component';
import { TranslatePipe } from '../../core/i18n/t.pipe';

/**
 * Platform → Message providers → Email, SMS or WhatsApp: the accounts of one channel that every
 * pharmacy uses by default. The channel comes from the route's data.
 */
@Component({
  selector: 'app-platform-providers',
  imports: [TranslatePipe, ProviderSettingsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'providers.title.' + channel() | t }}</h1>
          <p class="sub">{{ 'providers.platformSub' | t }}</p>
        </div>
      </div>
      <app-provider-settings scope="platform" [channel]="channel()" />
    </div>
  `,
})
export default class PlatformProvidersPage {
  readonly channel = input<ProviderChannel>('EMAIL');
}
