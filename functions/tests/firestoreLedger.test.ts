import type { Firestore } from 'firebase-admin/firestore';
import { MemoryFirestore } from './support/memoryFirestore';
jest.mock('firebase-functions/v2/https', () => ({ HttpsError: class extends Error { constructor(public code: string, message: string) { super(message); } } }));
jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'SERVER_TIME' } }));
import { prepareWalletMutation, migrateWallet, walletReceiptId, deletionLockId } from '../src/wallet/firestoreLedger';
import type { MutationInput } from '../src/wallet/ledger';
let memory: MemoryFirestore;
const db = () => memory as unknown as Firestore;
const mutation = (input: MutationInput, uid = 'rider') => memory.runTransaction(async tx => {
  const prepared = await prepareWalletMutation(db(), tx, uid, input); prepared.commit(); return prepared;
});
const seedBalance = async (amount = 10) => mutation({ operation: 'credit', amount, reference: 'initial_earn' });
beforeEach(() => { memory = new MemoryFirestore(); memory.seed('wallet_control/current', { state: 'active', schemaVersion: 1 }); });
it('atomically creates zero opening and earned balance, replays deterministic receipt', async () => {
  await seedBalance(); await seedBalance();
  expect(memory.value('user_tokens/rider')).toMatchObject({ schemaVersion: 1, balance: 10, reservedBalance: 0, lifetimeEarned: 10 });
  expect(memory.paths('token_ledger/')).toHaveLength(2);
  expect(memory.value(`token_ledger/${walletReceiptId('rider', 'opening', 'v1')}`).amount).toBe(0);
});
it('stages all writes only after caller reads and rolls back the entire unit on caller failure', async () => {
  await expect(memory.runTransaction(async tx => {
    const pending = await prepareWalletMutation(db(), tx, 'rider', { operation: 'credit', amount: 5, reference: 'earn' });
    await tx.get(memory.collection('quiz').doc('challenge')); pending.commit(); throw new Error('challenge failed');
  })).rejects.toThrow('challenge failed');
  expect(memory.paths('user_tokens/')).toEqual([]); expect(memory.paths('token_ledger/')).toEqual([]);
});
it('retries concurrent reserve and voucher spend without spending reserved tokens twice', async () => {
  await seedBalance();
  const outcomes = await Promise.allSettled([
    mutation({ operation: 'reserve', amount: 7, reference: 'route_job' }),
    mutation({ operation: 'spend', amount: 7, reference: 'voucher' }),
  ]);
  expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  const account = memory.value('user_tokens/rider');
  expect(account.balance).toBe(3); expect([0, 7]).toContain(account.reservedBalance);
  expect(memory.paths('token_ledger/')).toHaveLength(3);
});
it('only one capture or release wins; duplicate capture is an unchanged replay', async () => {
  await seedBalance(); await mutation({ operation: 'reserve', amount: 1, reference: 'job' });
  const outcomes = await Promise.allSettled([
    mutation({ operation: 'capture', amount: 1, reference: 'job' }),
    mutation({ operation: 'release', amount: 1, reference: 'job' }),
  ]);
  expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(memory.value('user_tokens/rider').reservedBalance).toBe(0);
  const terminal = memory.value(`token_reservations/${walletReceiptId('rider', 'reservation', 'job')}`).state;
  const account = memory.value('user_tokens/rider');
  const replay = await mutation({ operation: terminal === 'captured' ? 'capture' : 'release', amount: 1, reference: 'job' });
  expect(replay.replay).toBe(true); expect(memory.value('user_tokens/rider')).toEqual(account);
});
it('blocks paused writers and legacy accounts; migration requires pause and is repeatable', async () => {
  memory.seed('user_tokens/rider', { balance: 4, lifetimeEarned: 8 });
  await expect(migrateWallet(db(), 'rider')).rejects.toMatchObject({ code: 'failed-precondition' });
  await expect(seedBalance()).rejects.toMatchObject({ code: 'failed-precondition' });
  memory.seed('wallet_control/current', { state: 'paused' });
  await expect(seedBalance()).rejects.toMatchObject({ code: 'failed-precondition' });
  expect(await migrateWallet(db(), 'rider')).toBe('migrated');
  expect(await migrateWallet(db(), 'rider')).toBe('already_migrated');
  expect(memory.value('user_tokens/rider')).toMatchObject({ balance: 4, lifetimeEarned: 8, reservedBalance: 0 });
  expect(memory.paths('token_ledger/')).toHaveLength(1);
});
it('blocks new work after deletion, permits reservation release and never resurrects a missing account', async () => {
  await seedBalance(); await mutation({ operation: 'reserve', amount: 2, reference: 'job' });
  memory.seed(`account_deletion_locks/${deletionLockId('rider')}`, { blocked: true });
  await expect(mutation({ operation: 'capture', amount: 2, reference: 'job' })).rejects.toMatchObject({ code: 'permission-denied' });
  await mutation({ operation: 'release', amount: 2, reference: 'job' });
  expect(memory.value('user_tokens/rider').balance).toBe(10);
  await expect(mutation({ operation: 'credit', amount: 2, reference: 'late_earn' })).rejects.toMatchObject({ code: 'permission-denied' });
  await expect(mutation({ operation: 'capture', amount: 0, reference: 'late' }, 'missing')).rejects.toMatchObject({ code: 'failed-precondition' });
});
it('invalidates a capture transaction when the deletion lock appears before commit', async () => {
  await seedBalance(); await mutation({ operation: 'reserve', amount: 2, reference: 'job' });
  let once = false;
  await expect(memory.runTransaction(async tx => {
    const pending = await prepareWalletMutation(db(), tx, 'rider', { operation: 'capture', amount: 2, reference: 'job' });
    if (!once) { once = true; memory.seed(`account_deletion_locks/${deletionLockId('rider')}`, { blocked: true }); }
    pending.commit();
  })).rejects.toMatchObject({ code: 'permission-denied' });
  expect(memory.value('user_tokens/rider').reservedBalance).toBe(2);
});
it('separates accounts and rejects changed replay amount, suspension and missing opening receipts', async () => {
  await seedBalance();
  expect(walletReceiptId('rider', 'credit', 'same')).not.toBe(walletReceiptId('other', 'credit', 'same'));
  await expect(seedBalance(11)).rejects.toMatchObject({ code: 'failed-precondition' });
  memory.seed('suspended_users/rider', { reason: 'test' });
  await expect(mutation({ operation: 'reserve', amount: 1, reference: 'job' })).rejects.toMatchObject({ code: 'failed-precondition' });
  memory.seed('wallet_control/current', { state: 'paused' });
  memory.seed('user_tokens/orphan', { schemaVersion: 1, balance: 1, reservedBalance: 0, lifetimeEarned: 1 });
  await expect(migrateWallet(db(), 'orphan')).rejects.toThrow('Opening receipt missing');
});
it('rejects invalid identifiers, absent control and schema mismatch before creating value', async () => {
  for (const uid of ['', 'bad/uid', 'x'.repeat(129), null]) {
    await expect(mutation({ operation: 'credit', amount: 1, reference: 'credit' }, uid as any)).rejects.toMatchObject({ code: 'invalid-argument' });
  }
  memory = new MemoryFirestore();
  await expect(seedBalance()).rejects.toMatchObject({ code: 'failed-precondition' });
  memory.seed('wallet_control/current', { state: 'active', schemaVersion: 2 });
  await expect(seedBalance()).rejects.toMatchObject({ code: 'failed-precondition' });
  expect(memory.paths('user_tokens/')).toEqual([]);
});
it('stages a prepared mutation only once and permits cleanup during a pause and suspension', async () => {
  await seedBalance(); await mutation({ operation: 'reserve', amount: 2, reference: 'job' });
  memory.seed('wallet_control/current', { state: 'paused' }); memory.seed('suspended_users/rider', { blocked: true });
  await memory.runTransaction(async tx => {
    const pending = await prepareWalletMutation(db(), tx, 'rider', { operation: 'release', amount: 2, reference: 'job' });
    pending.commit(); expect(() => pending.commit()).toThrow('MUTATION_ALREADY_STAGED');
  });
  expect(memory.value('user_tokens/rider').reservedBalance).toBe(0);
});
it('refuses migration of missing/deleting accounts and conflicting opening receipts', async () => {
  memory.seed('wallet_control/current', { state: 'paused' });
  await expect(migrateWallet(db(), 'missing')).rejects.toThrow('Account unavailable');
  memory.seed('user_tokens/rider', { balance: 4, lifetimeEarned: 4 });
  memory.seed(`token_ledger/${walletReceiptId('rider', 'opening', 'v1')}`, { amount: 4 });
  await expect(migrateWallet(db(), 'rider')).rejects.toThrow('Opening receipt conflicts');
  memory.seed(`account_deletion_locks/${deletionLockId('rider')}`, { blocked: true });
  await expect(migrateWallet(db(), 'rider')).rejects.toThrow('Account unavailable');
});
it('does not disguise unexpected snapshot decoding errors as an invalid balance', async () => {
  const tx = { get: async (ref: any) => ref.path === 'user_tokens/rider'
    ? { exists: true, data: () => { throw new Error('snapshot decoding failed'); } }
    : { exists: false, data: () => ref.path === 'wallet_control/current' ? { state: 'active', schemaVersion: 1 } : undefined } };
  await expect(prepareWalletMutation(db(), tx as any, 'rider', { operation: 'credit', amount: 1, reference: 'credit' })).rejects.toThrow('snapshot decoding failed');
});
