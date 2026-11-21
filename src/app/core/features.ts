/**
 * Parts of the app switched off for now. They stay in the code, so turning one on is a change here.
 */

/**
 * Till shifts: opening a shift with a float, closing it with a cash count and Z-report (the POS
 * strip and Sales → Shifts). Off until the till is in use; selling never needed an open shift.
 */
export const TILL_SHIFTS_ENABLED = false;

/** The POS payment card's quick cash amounts (1,000, 2,000 …); Exact always shows. */
export const QUICK_CASH_AMOUNTS_ENABLED = false;
