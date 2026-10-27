jest.mock('firebase-functions/v2/https', () => ({ onCall: (_: any, handler: any) => handler,
  HttpsError: class extends Error { constructor(public code: string, message: string) { super(message); } } }));
import { createRoutingLimiter } from '../src/routing/placeSearch';
import { MemoryFirestore } from './support/memoryFirestore';
import type { Firestore } from 'firebase-admin/firestore';
it('enforces the rolling minute even across hourly hash rotation, then expires old requests', async () => {
  const db = new MemoryFirestore(); let now = 3599000;
  const limit = createRoutingLimiter(db as unknown as Firestore, () => 'test-only-secret', () => now);
  for (let i = 0; i < 15; i++) await limit({ auth: { uid: 'rider' } }, 'route');
  now = 3600001;
  await expect(limit({ auth: { uid: 'rider' } }, 'route')).rejects.toMatchObject({ code: 'resource-exhausted' });
  now += 60000; await limit({ auth: { uid: 'rider' } }, 'route');
  for (const path of db.paths('routing_rate_limits/')) {
    expect(path).toMatch(/^routing_rate_limits\/[a-f0-9]{64}$/);
    expect(JSON.stringify(db.value(path))).not.toContain('rider');
    expect(typeof db.value(path).expiresAt.getTime).toBe('function');
    expect(db.value(path).expiresAt.getTime()).toBeGreaterThan(now);
  }
});
it('separates search/route subjects and serializes simultaneous attempts', async () => {
  const db = new MemoryFirestore(), limit = createRoutingLimiter(db as unknown as Firestore, () => 'test-only-secret', () => 1000);
  const outcomes = await Promise.allSettled(Array.from({ length: 16 }, () => limit({ ip: '192.0.2.1' }, 'route')));
  // The test double has a bounded retry count; use the sequential suite above for exact admission count.
  expect(outcomes.filter(result => result.status === 'fulfilled').length).toBeLessThanOrEqual(15);
  await limit({ ip: '192.0.2.1' }, 'search');
  await limit({ auth: { uid: 'other' }, ip: '192.0.2.1' }, 'route');
  expect(db.paths('routing_rate_limits/')).toHaveLength(3);
});
it('fails closed without an identity or secret', async () => {
  const db = new MemoryFirestore();
  await expect(createRoutingLimiter(db as unknown as Firestore, () => '')({ ip: '192.0.2.1' }, 'route')).rejects.toMatchObject({ code: 'unavailable' });
  await expect(createRoutingLimiter(db as unknown as Firestore, () => 'test')({}, 'route')).rejects.toMatchObject({ code: 'unavailable' });
  expect(db.paths('routing_rate_limits/')).toHaveLength(0);
});
