import { ApiError } from '../api/api-error';
import { SuspensionKind, TenantStatus } from '../api/models';

/**
 * What the shell knows of why a pharmacy is suspended: a kind the API named (tenancy
 * SuspensionKind), `PLATFORM` when only "not unpaid" is known (the platform suspended it, or a
 * legal hold), or null while unknown.
 */
export type KnownSuspension = SuspensionKind | 'PLATFORM' | null;

/** The page a member sees in a pharmacy that is not active, and what they may still do there. */
export interface SuspensionView {
  /** `unpaid`, `legal-hold`, `platform`, `suspended` (kind unknown), `closed` or `erased`. */
  readonly state: string;
  readonly icon: string;
  readonly title: string;
  readonly body: string;
  readonly hint: string | null;
  /** The subscription page stays open, to see the invoice and how to pay. */
  readonly canPay: boolean;
  /** The download of all its data (the API allows it to admins of an unpaid or closed pharmacy). */
  readonly canExport: boolean;
}

/**
 * The page for a pharmacy in `status`. `admin` is the API's test: the member may manage settings
 * or users. An unpaid pharmacy's admins keep reading it, so they can pay and take their data out;
 * everyone else, and every other kind, is shut out.
 */
export function suspensionView(
  status: TenantStatus,
  kind: KnownSuspension,
  admin: boolean,
): SuspensionView {
  const view = (state: string, icon: string, hint: string | null = null) => ({
    state,
    icon,
    title: `state.suspended.${state}.title`,
    body: `state.suspended.${state}.body${state === 'unpaid' ? (admin ? '.admin' : '.staff') : ''}`,
    hint,
    canPay: false,
    canExport: false,
  });
  switch (status) {
    case 'CLOSED':
      return { ...view('closed', 'lock'), canExport: admin };
    case 'ERASED':
      return view('erased', 'lock');
    default:
      break;
  }
  switch (kind) {
    case 'UNPAID':
      return {
        ...view('unpaid', 'card', admin ? null : 'state.suspended.unpaid.hint'),
        canPay: admin,
        canExport: admin,
      };
    case 'DISPUTE':
      return view('legal-hold', 'shield', 'state.suspended.contact');
    case 'ABUSE':
    case 'OTHER':
    case 'PLATFORM':
      return view('platform', 'lock', 'state.suspended.contact');
    default:
      return view('suspended', 'lock', 'state.suspended.suspended.hint');
  }
}

/**
 * What a read refused (or allowed) tells of a suspended pharmacy. Only an unpaid pharmacy's admins
 * may still read, so an answer means UNPAID; `tenant_suspended_read_only` says the same. A plain
 * `tenant_suspended` to an admin means another kind; to anyone else it does not tell. A
 * `suspensionKind` member on the problem, when the API sends one, is taken as it is.
 */
export function suspensionFromProbe(answer: ApiError | null, admin: boolean): KnownSuspension {
  if (!answer) {
    return 'UNPAID';
  }
  const named = answer.extras['suspensionKind'] ?? answer.extras['kind'];
  if (named === 'UNPAID' || named === 'DISPUTE' || named === 'ABUSE' || named === 'OTHER') {
    return named;
  }
  if (answer.reason === 'tenant_suspended_read_only') {
    return 'UNPAID';
  }
  return answer.reason === 'tenant_suspended' && admin ? 'PLATFORM' : null;
}
