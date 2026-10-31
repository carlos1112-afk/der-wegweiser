/** Pure ledger invariants. Firestore transaction integration is gated on emulator/migration acceptance. */
export interface WalletV1 {
  readonly schemaVersion: 1;
  readonly balance: number;
  readonly reservedBalance: number;
  readonly lifetimeEarned: number;
}
export type Operation = 'credit' | 'reserve' | 'capture' | 'release' | 'spend' | 'refund';
export interface LedgerEntry {
  readonly reference: string;
  readonly operation: Operation;
  readonly amount: number;
  readonly balanceDelta: number;
  readonly reservedDelta: number;
}
export interface Reservation {
  readonly reference: string;
  readonly amount: number;
  readonly state: 'reserved' | 'captured' | 'released' | 'refunded';
}
export class WalletError extends Error {}
function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
export function parseWallet(value: unknown): WalletV1 {
  const w = value as WalletV1 | null;
  if (!w || w.schemaVersion !== 1 || !integer(w.balance) || !integer(w.reservedBalance) || !integer(w.lifetimeEarned)
    || !Number.isSafeInteger(w.balance + w.reservedBalance)) throw new WalletError('INVALID_WALLET');
  return { schemaVersion: 1, balance: w.balance, reservedBalance: w.reservedBalance, lifetimeEarned: w.lifetimeEarned };
}
/** Never invents a missing balance. Run under a real mutation pause in the migration transaction. */
export function openingWallet(value: unknown): { wallet: WalletV1; openingBalance: number; alreadyMigrated: boolean } {
  if (!value || typeof value !== 'object') throw new WalletError('INVALID_LEGACY_WALLET');
  const w = value as Record<string, unknown>;
  if (w.schemaVersion === 1) return { wallet: parseWallet(w), openingBalance: 0, alreadyMigrated: true };
  if (w.schemaVersion !== undefined || !integer(w.balance) || !integer(w.lifetimeEarned)
    || (w.reservedBalance !== undefined && w.reservedBalance !== 0)) throw new WalletError('INVALID_LEGACY_WALLET');
  return { wallet: { schemaVersion: 1, balance: w.balance, reservedBalance: 0, lifetimeEarned: w.lifetimeEarned }, openingBalance: w.balance, alreadyMigrated: false };
}
export interface MutationInput { operation: Operation; amount: number; reference: string }
export interface MutationResult { wallet: WalletV1; entry: LedgerEntry; reservation: Reservation | null; replay: boolean }
/** A transaction must read account, operation receipt, reservation and deletion/suspension lock before calling this function. */
export function applyWalletMutation(input: MutationInput, current: WalletV1, reservation: Reservation | null,
  receipt: LedgerEntry | null, locked: boolean): MutationResult {
  const wallet = parseWallet(current);
  if (!input || !integer(input.amount) || typeof input.reference !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.reference)) throw new WalletError('INVALID_OPERATION');
  if (receipt) {
    if (receipt.reference !== input.reference || receipt.operation !== input.operation || receipt.amount !== input.amount) throw new WalletError('IDEMPOTENCY_CONFLICT');
    return { wallet, entry: receipt, reservation, replay: true };
  }
  // Cleanup may release reserves on a locked/deleting account; no new value or work may be created.
  if (locked && input.operation !== 'release') throw new WalletError('ACCOUNT_LOCKED');
  let balanceDelta = 0, reservedDelta = 0, earnedDelta = 0;
  let nextReservation = reservation;
  const requireReservation = (state: Reservation['state']) => {
    if (!reservation || reservation.reference !== input.reference || reservation.amount !== input.amount || reservation.state !== state) throw new WalletError('INVALID_RESERVATION');
  };
  switch (input.operation) {
    case 'credit': balanceDelta = input.amount; earnedDelta = input.amount; break;
    case 'spend': balanceDelta = -input.amount; break;
    case 'reserve':
      if (reservation) throw new WalletError('RESERVATION_EXISTS');
      balanceDelta = -input.amount; reservedDelta = input.amount;
      nextReservation = { reference: input.reference, amount: input.amount, state: 'reserved' };
      break;
    case 'capture':
      requireReservation('reserved'); reservedDelta = -input.amount;
      nextReservation = { ...reservation!, state: 'captured' }; break;
    case 'release':
      requireReservation('reserved'); balanceDelta = input.amount; reservedDelta = -input.amount;
      nextReservation = { ...reservation!, state: 'released' }; break;
    case 'refund':
      requireReservation('captured'); balanceDelta = input.amount;
      nextReservation = { ...reservation!, state: 'refunded' }; break;
    default: throw new WalletError('INVALID_OPERATION');
  }
  const updated = parseWallet({ schemaVersion: 1, balance: wallet.balance + balanceDelta,
    reservedBalance: wallet.reservedBalance + reservedDelta, lifetimeEarned: wallet.lifetimeEarned + earnedDelta });
  return { wallet: updated, entry: { ...input, balanceDelta, reservedDelta }, reservation: nextReservation, replay: false };
}
/** Read-only aggregation. Caller supplies snapshots; this module has no database/network dependency. */
export function auditMigration(accounts: readonly { id: string; data: unknown }[]): {
  count: number; validCount: number; totalBalance: string; invalidIds: string[]; migratedCount: number;
} {
  let total = BigInt(0), validCount = 0, migratedCount = 0;
  const invalidIds: string[] = [];
  for (const account of accounts) {
    try {
      const result = openingWallet(account.data);
      total += BigInt(result.wallet.balance);
      validCount++;
      if (result.alreadyMigrated) migratedCount++;
    } catch (error) {
      if (!(error instanceof WalletError)) throw error;
      invalidIds.push(account.id);
    }
  }
  return { count: accounts.length, validCount, totalBalance: total.toString(), invalidIds, migratedCount };
}
