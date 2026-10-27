import { applyWalletMutation as apply, openingWallet, parseWallet, auditMigration } from '../src/wallet/ledger';
import type { WalletV1 } from '../src/wallet/ledger';
const wallet = (balance = 10): WalletV1 => ({ schemaVersion: 1, balance, reservedBalance: 0, lifetimeEarned: balance });
describe('wallet invariants (pure, no emulator claim)', () => {
  it('reserve prevents spending the same tokens, release restores them', () => {
    const reserve = apply({ reference: 'job', operation: 'reserve', amount: 7 }, wallet(), null, null, false);
    expect(reserve.wallet).toMatchObject({ balance: 3, reservedBalance: 7 });
    expect(() => apply({ reference: 'voucher', operation: 'spend', amount: 4 }, reserve.wallet, null, null, false)).toThrow();
    const release = apply({ reference: 'job', operation: 'release', amount: 7 }, reserve.wallet, reserve.reservation, null, true);
    expect(release.wallet).toEqual(wallet());
    expect(() => apply({ reference: 'job', operation: 'capture', amount: 7 }, release.wallet, release.reservation, null, false)).toThrow();
  });
  it('capture, cancel and refund each have one legal outcome and replay cannot change balance', () => {
    const reserve = apply({ reference: 'job', operation: 'reserve', amount: 1 }, wallet(), null, null, false);
    const capture = apply({ reference: 'job', operation: 'capture', amount: 1 }, reserve.wallet, reserve.reservation, null, false);
    expect(capture.wallet).toMatchObject({ balance: 9, reservedBalance: 0 });
    const replay = apply({ reference: 'job', operation: 'capture', amount: 1 }, capture.wallet, capture.reservation, capture.entry, false);
    expect(replay.replay).toBe(true); expect(replay.wallet).toEqual(capture.wallet);
    expect(() => apply({ reference: 'job', operation: 'release', amount: 1 }, capture.wallet, capture.reservation, null, false)).toThrow();
    const refund = apply({ reference: 'job', operation: 'refund', amount: 1 }, capture.wallet, capture.reservation, null, false);
    expect(refund.wallet).toEqual(wallet());
    expect(() => apply({ reference: 'job', operation: 'refund', amount: 1 }, refund.wallet, refund.reservation, null, false)).toThrow();
    expect(() => apply({ reference: 'job', operation: 'capture', amount: 2 }, capture.wallet, capture.reservation, capture.entry, false)).toThrow('IDEMPOTENCY_CONFLICT');
  });
  it.each([NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, '1', null])('rejects bad balances/amounts: %s', value => {
    expect(() => parseWallet({ ...wallet(), balance: value })).toThrow();
    expect(() => apply({ reference: 'earn', operation: 'credit', amount: value as number }, wallet(), null, null, false)).toThrow();
  });
  it('rejects overflow of available/reserved/earned and operation/reference mismatch', () => {
    expect(() => apply({ reference: 'earn', operation: 'credit', amount: 1 }, wallet(Number.MAX_SAFE_INTEGER), null, null, false)).toThrow();
    expect(() => parseWallet({ ...wallet(Number.MAX_SAFE_INTEGER), reservedBalance: 1 })).toThrow();
    expect(() => apply({ reference: '../job', operation: 'credit', amount: 1 }, wallet(), null, null, false)).toThrow();
    expect(() => apply({ reference: 'job', operation: 'capture', amount: 1 }, wallet(), null, null, false)).toThrow();
  });
  it('locks mutation, zero-price reservations still have lifecycle', () => {
    for (const operation of ['credit', 'spend', 'reserve', 'capture', 'refund'] as const) {
      expect(() => apply({ reference: 'x', operation, amount: 0 }, wallet(), null, null, true)).toThrow('ACCOUNT_LOCKED');
    }
    const reserved = apply({ reference: 'zero', operation: 'reserve', amount: 0 }, wallet(), null, null, false);
    expect(apply({ reference: 'zero', operation: 'capture', amount: 0 }, reserved.wallet, reserved.reservation, null, false).reservation?.state).toBe('captured');
  });
  it('migration preserves zero, rejects missing balances, audit sums without precision loss', () => {
    expect(openingWallet({ balance: 0, lifetimeEarned: 0 }).wallet).toEqual(wallet(0));
    expect(openingWallet(wallet()).alreadyMigrated).toBe(true);
    for (const value of [null, {}, { balance: null, lifetimeEarned: 0 }, { balance: 1, lifetimeEarned: 1, reservedBalance: 1 }]) {
      expect(() => openingWallet(value)).toThrow();
    }
    expect(auditMigration([{ id: 'a', data: wallet(Number.MAX_SAFE_INTEGER) }, { id: 'b', data: wallet(Number.MAX_SAFE_INTEGER) }, { id: 'c', data: {} }]))
      .toEqual({ count: 3, validCount: 2, totalBalance: '18014398509481982', invalidIds: ['c'], migratedCount: 2 });
  });
  it('rejects unknown operations and mismatched reservation bindings', () => {
    expect(() => apply({ reference: 'job', operation: 'unknown' as any, amount: 1 }, wallet(), null, null, false)).toThrow('INVALID_OPERATION');
    expect(() => apply(null as any, wallet(), null, null, false)).toThrow('INVALID_OPERATION');
    expect(() => apply({ reference: 12 as any, operation: 'credit', amount: 1 }, wallet(), null, null, false)).toThrow('INVALID_OPERATION');
    const reserved = apply({ reference: 'job', operation: 'reserve', amount: 1 }, wallet(), null, null, false);
    expect(() => apply({ reference: 'job', operation: 'reserve', amount: 1 }, reserved.wallet, reserved.reservation, null, false)).toThrow('RESERVATION_EXISTS');
    for (const reservation of [{ ...reserved.reservation!, reference: 'other' }, { ...reserved.reservation!, amount: 2 }]) {
      expect(() => apply({ reference: 'job', operation: 'capture', amount: 1 }, reserved.wallet, reservation, null, false)).toThrow('INVALID_RESERVATION');
    }
    expect(() => openingWallet({ balance: 1, lifetimeEarned: 1, schemaVersion: 2 })).toThrow();
    const credit = apply({ reference: 'earn', operation: 'credit', amount: 2 }, wallet(), null, null, false);
    expect(credit.wallet).toEqual(wallet(12));
    expect(apply({ reference: 'voucher', operation: 'spend', amount: 3 }, wallet(), null, null, false).wallet.balance).toBe(7);
  });

});
