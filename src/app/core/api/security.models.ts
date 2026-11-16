/** Account security, invitations and the audit trail (contract: Security and Audit sections). */
import { IsoDateTime, Uid } from './models';

/** `POST /auth/sign-in` answers 202 with this when the account has two-factor on. */
export interface SignInChallenge {
  challengeToken: string;
  methods: ('TOTP' | 'RECOVERY_CODE' | 'PASSKEY')[];
  expiresAt: IsoDateTime;
}

export interface SecurityOverview {
  twoFactorEnabled: boolean;
  twoFactorEnabledAt: IsoDateTime | null;
  recoveryCodesLeft: number;
  passkeys: number;
  twoFactorRequired: boolean;
}

export interface TwoFactorSetup {
  secret: string;
  otpauthUri: string;
}

export interface RecoveryCodes {
  recoveryCodes: string[];
}

/** `options` is `{ publicKey: {...} }` in the WebAuthn JSON form (base64url values). */
export interface PasskeyOptions {
  ceremonyUid: Uid;
  options: { publicKey: Record<string, unknown> };
}

export interface Passkey {
  uid: Uid;
  name: string;
  transports: string | null;
  createdAt: IsoDateTime;
  lastUsedAt: IsoDateTime | null;
}

export interface SessionInfo {
  uid: Uid;
  method: 'PASSWORD' | 'TWO_FACTOR' | 'PASSKEY' | 'INVITATION' | string;
  ip: string | null;
  userAgent: string | null;
  createdAt: IsoDateTime;
  lastSeenAt: IsoDateTime | null;
  expiresAt: IsoDateTime;
  current: boolean;
}

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

export interface Invitation {
  uid: Uid;
  email: string;
  name: string;
  roleUid: Uid;
  roleName: string;
  allBranches: boolean;
  branchUids: Uid[];
  status: InvitationStatus;
  invitedBy: string;
  expiresAt: IsoDateTime;
  createdAt: IsoDateTime;
}

export interface InvitationPreview {
  email: string;
  name: string;
  tenantUid: Uid;
  tenantName: string | null;
  roleName: string;
  invitedBy: string;
  expiresAt: IsoDateTime;
  status: InvitationStatus;
  existingUser: boolean;
}

export interface AuditEntry {
  uid: Uid;
  at: IsoDateTime;
  actor: string;
  action: string;
  entityType: string | null;
  entityUid: Uid | null;
  tenantUid: Uid | null;
  branchUid: Uid | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  correlationId: string | null;
  /** A readable name for the record (number, name, email or code) captured when written. */
  label?: string | null;
}

/** A member locked out after repeated failed sign-ins (GET /users/locked). */
export interface LockedMember {
  membershipUid: Uid;
  userUid: Uid;
  lockedUntil: IsoDateTime;
}

export function isChallenge(value: unknown): value is SignInChallenge {
  return !!value && typeof value === 'object' && 'challengeToken' in value;
}
