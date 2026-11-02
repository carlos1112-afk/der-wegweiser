import { describe, it, expect } from '@jest/globals';
import { ROUTE_ARTIFACT_RETENTION_MS } from '../src/routing/premiumRoute';

describe('Retention and Cleanup Configuration', () => {
  it('enforces a 30-day retention window for route artifacts', () => {
    expect(ROUTE_ARTIFACT_RETENTION_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
