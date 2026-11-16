import { IsoDateTime, Uid } from '../api/models';

/** How a message reaches its recipient. */
export type Channel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP';

export const CHANNELS: readonly Channel[] = ['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP'];

export type Severity = 'info' | 'warning' | 'critical';

export interface InAppNotification {
  uid: Uid;
  title: string;
  body: string;
  link: string | null;
  severity: Severity;
  read: boolean;
  createdAt: IsoDateTime;
}

/** What the live stream pushes: on connect (`ready`, latest null) and per new message. */
export interface StreamEvent {
  unreadCount: number;
  latest: InAppNotification | null;
}

export interface UnreadCount {
  count: number;
}

export interface NotificationPreference {
  category: string;
  channels: Channel[];
}

export interface NotificationTemplate {
  key: string;
  channel: Channel;
  locale: 'en' | 'sw';
  subject: string | null;
  body: string;
  custom: boolean;
}

export interface RenderedPreview {
  subject: string | null;
  text: string;
  html: string | null;
  sampleParams: Record<string, unknown>;
}

export type DeliveryStatus = 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED';

export interface NotificationDelivery {
  uid: Uid;
  templateKey: string;
  channel: Channel;
  to: string;
  status: DeliveryStatus;
  provider: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: IsoDateTime;
  sentAt: IsoDateTime | null;
}

export const CHANNEL_LABELS: Record<Channel, string> = {
  IN_APP: 'In-app',
  EMAIL: 'Email',
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
};

export const CHANNEL_ICONS: Record<Channel, string> = {
  IN_APP: 'bell',
  EMAIL: 'mail',
  SMS: 'phone',
  WHATSAPP: 'phone',
};

export const CATEGORY_LABELS: Record<string, { label: string; hint: string }> = {
  stock: { label: 'Stock alerts', hint: 'Low stock and batches nearing expiry' },
  sales: { label: 'Sales', hint: 'Receipts sent to customers' },
  reports: { label: 'Daily summary', hint: "The day's sales at closing time" },
  customers: { label: 'Customers', hint: 'Overdue balance reminders' },
  tenant: { label: 'Pharmacy', hint: 'Welcome and account news' },
  access: { label: 'Security', hint: 'Password resets, sign-in codes and new devices — always on' },
};

export const TEMPLATE_LABELS: Record<string, string> = {
  'stock.low': 'Low stock',
  'stock.expiring': 'Expiry digest',
  'sale.receipt': 'Sale receipt',
  'daily.summary': 'Daily summary',
  'customer.overdue': 'Overdue reminder',
  'access.invitation': 'User invitation',
  'access.password_reset': 'Password reset',
  'access.new_sign_in': 'New sign-in',
  'access.two_factor_code': 'Sign-in code',
  'tenant.welcome': 'Welcome',
  'provider.test': 'Provider test message',
};
