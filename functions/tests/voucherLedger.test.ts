import { MemoryFirestore } from './support/memoryFirestore';
const mockDb = new MemoryFirestore();
jest.mock('firebase-admin', () => ({ initializeApp: jest.fn() }));
jest.mock('firebase-admin/firestore', () => ({ getFirestore: () => mockDb, FieldValue: { serverTimestamp: () => 'SERVER_TIME' } }));
jest.mock('firebase-functions/v2/https', () => ({
  onCall: (_config: any, handler: any) => handler,
  HttpsError: class extends Error { constructor(public code: string, message: string) { super(message); } },
}));
const { redeemVoucher } = require('../src/index');
const { prepareWalletMutation } = require('../src/wallet/firestoreLedger');
it('charges vouchers even with legacy unlimited flags and atomically records exactly one redemption', async () => {
  mockDb.seed('wallet_control/current', { state: 'active', schemaVersion: 1 });
  mockDb.seed('user_tokens/rider', { userId: 'rider', schemaVersion: 1, balance: 100, reservedBalance: 0, lifetimeEarned: 100, unlimitedOnDemand: true });
  const request = { auth: { uid: 'rider' }, app: { appId: 'app' }, data: { itemId: 'coffee-pass' } };
  const outcomes = await Promise.allSettled([redeemVoucher(request), redeemVoucher(request)]);
  expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(mockDb.value('user_tokens/rider').balance).toBe(60);
  expect(mockDb.paths('voucher_redemptions/')).toHaveLength(1);
  expect(mockDb.paths('token_ledger/')).toHaveLength(1);
  const suspended = { ...request, auth: { uid: 'suspended' } };
  mockDb.seed('suspended_users/suspended', { blocked: true });
  await expect(redeemVoucher(suspended)).rejects.toMatchObject({ code: 'permission-denied' });
});
it('does not let a voucher consume a premium reservation', async () => {
  mockDb.seed('user_tokens/reserved', { userId: 'reserved', schemaVersion: 1, balance: 40, reservedBalance: 0, lifetimeEarned: 40 });
  await mockDb.runTransaction(async tx => { const pending = await prepareWalletMutation(mockDb, tx, 'reserved', { operation: 'reserve', amount: 1, reference: 'route' }); pending.commit(); });
  await expect(redeemVoucher({ auth: { uid: 'reserved' }, app: {}, data: { itemId: 'coffee-pass' } })).rejects.toMatchObject({ code: 'failed-precondition' });
  expect(mockDb.value('user_tokens/reserved')).toMatchObject({ balance: 39, reservedBalance: 1 });
  expect(mockDb.value('voucher_redemptions/coffee-pass_reserved')).toBeUndefined();
});
