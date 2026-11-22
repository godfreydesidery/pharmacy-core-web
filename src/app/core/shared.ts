import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FORMAT_PIPES } from './format/pipes';
import { TranslatePipe } from './i18n/t.pipe';
import { CHARTS } from './ui/charts';
import { BranchRequiredComponent } from './ui/forms';
import { IconComponent } from './ui/icon.component';
import { DrawerComponent, ModalComponent } from './ui/overlay.components';
import { EmptyComponent, PagerComponent, StatComponent, StatusBadgeComponent } from './ui/widgets';
import { ExportComponent } from './ui/export.component';
import { ImportComponent } from './ui/import.component';

/** What almost every page imports. */
export const SHARED = [
  ReactiveFormsModule,
  RouterLink,
  IconComponent,
  StatusBadgeComponent,
  StatComponent,
  EmptyComponent,
  PagerComponent,
  ExportComponent,
  ImportComponent,
  ModalComponent,
  DrawerComponent,
  BranchRequiredComponent,
  ...CHARTS,
  ...FORMAT_PIPES,
  TranslatePipe,
] as const;
