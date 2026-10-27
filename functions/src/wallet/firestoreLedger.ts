import { createHash } from 'node:crypto';
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { applyWalletMutation, openingWallet, parseWallet, WalletError } from './ledger';
import type { LedgerEntry, MutationInput, Reservation, WalletV1 } from './ledger';

export function deletionLockId(uid: string): string {
  return createHash('sha256').update(uid).digest('hex');
}
function checkUid(uid: string): void {
  if (typeof uid !== 'string' || !uid.length || uid.length > 128 || uid.includes('/')) throw new HttpsError('invalid-argument', 'Invalid account.');
}
export function walletReceiptId(uid: string, operation: string, reference: string): string {
  return createHash('sha256').update(JSON.stringify([uid, operation, reference])).digest('hex');
}
/** Reads only. Caller may still read other documents; commit() stages writes in this SAME transaction. */
export async function prepareWalletMutation(db: Firestore, transaction: Transaction, uid: string, input: MutationInput): Promise<{
  wallet: WalletV1; replay: boolean; commit: () => void;
}> {
  checkUid(uid);
  const accountRef = db.collection('user_tokens').doc(uid);
  const receiptRef = db.collection('token_ledger').doc(walletReceiptId(uid, input.operation, input.reference));
  const reservationRef = db.collection('token_reservations').doc(walletReceiptId(uid, 'reservation', input.reference));
  const [control, account, receipt, reservation, suspension, deletion] = await Promise.all([
    transaction.get(db.collection('wallet_control').doc('current')),
    transaction.get(accountRef), transaction.get(receiptRef), transaction.get(reservationRef),
    transaction.get(db.collection('suspended_users').doc(uid)),
    transaction.get(db.collection('account_deletion_locks').doc(deletionLockId(uid))),
  ]);
  const cleanup = input.operation === 'release';
  if (deletion.exists && !cleanup) throw new HttpsError('permission-denied', 'Account deletion is in progress.');
  if (!cleanup && (control.data()?.state !== 'active' || control.data()?.schemaVersion !== 1)) {
    throw new HttpsError('failed-precondition', 'Token mutations are paused for migration.');
  }
  try {
    // Missing accounts may only be created by a legitimate server credit, never by late capture/release.
    const current = account.exists ? parseWallet(account.data()) :
      input.operation === 'credit' ? { schemaVersion: 1 as const, balance: 0, reservedBalance: 0, lifetimeEarned: 0 } : null;
    if (!current) throw new WalletError('ACCOUNT_NOT_FOUND');
    const result = applyWalletMutation(input, current, (reservation.data() as Reservation) ?? null,
      (receipt.data() as LedgerEntry) ?? null, suspension.exists || deletion.exists);
    let committed = false;
    return { wallet: result.wallet, replay: result.replay, commit: () => {
      if (committed) throw new WalletError('MUTATION_ALREADY_STAGED');
      committed = true;
      if (result.replay) return;
      if (!account.exists) transaction.create(db.collection('token_ledger').doc(walletReceiptId(uid, 'opening', 'v1')), {
        userId: uid, operation: 'opening', reference: 'v1', amount: 0, balanceDelta: 0, reservedDelta: 0, createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(accountRef, { userId: uid, ...result.wallet }, { merge: true });
      transaction.create(receiptRef, { userId: uid, ...result.entry, createdAt: FieldValue.serverTimestamp() });
      if (result.reservation) transaction.set(reservationRef, { userId: uid, ...result.reservation });
    } };
  } catch (error) {
    if (!(error instanceof WalletError)) throw error;
    throw new HttpsError('failed-precondition', error.message);
  }
}
/** Call only under the server-enforced writer pause. No provider/network work inside a transaction. */
export async function migrateWallet(db: Firestore, uid: string): Promise<'migrated' | 'already_migrated'> {
  checkUid(uid);
  return db.runTransaction(async transaction => {
    const accountRef = db.collection('user_tokens').doc(uid);
    const openingRef = db.collection('token_ledger').doc(walletReceiptId(uid, 'opening', 'v1'));
    const [control, account, opening, deletion] = await Promise.all([
      transaction.get(db.collection('wallet_control').doc('current')), transaction.get(accountRef),
      transaction.get(openingRef), transaction.get(db.collection('account_deletion_locks').doc(deletionLockId(uid))),
    ]);
    if (control.data()?.state !== 'paused') throw new HttpsError('failed-precondition', 'Writer pause required.');
    if (!account.exists || deletion.exists) throw new HttpsError('failed-precondition', 'Account unavailable.');
    const result = openingWallet(account.data());
    if (result.alreadyMigrated) {
      if (!opening.exists) throw new HttpsError('failed-precondition', 'Opening receipt missing.');
      return 'already_migrated';
    }
    if (opening.exists) throw new HttpsError('failed-precondition', 'Opening receipt conflicts with account schema.');
    transaction.set(accountRef, result.wallet, { merge: true });
    transaction.create(openingRef, { userId: uid, operation: 'opening', reference: 'v1', amount: result.openingBalance,
      balanceDelta: result.openingBalance, reservedDelta: 0, createdAt: FieldValue.serverTimestamp() });
    return 'migrated';
  });
}
