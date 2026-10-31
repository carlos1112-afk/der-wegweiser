import { RouteAiProviderError, scoreRouteCandidates } from '../src/routing/aiProvider';

it('retries transient AI-provider statuses and fails permanent authentication errors promptly', () => {
  expect(new RouteAiProviderError(401).retryable).toBe(false);
  expect(new RouteAiProviderError(408).retryable).toBe(true);
  expect(new RouteAiProviderError(429).retryable).toBe(true);
  expect(new RouteAiProviderError(503).retryable).toBe(true);
});

it('uses only measured route facts and keeps the selected primary priority dominant', () => {
  const scored = scoreRouteCandidates({
    candidates: [
      { id: 'short', distanceM: 10_000, ascentM: 180, durationS: 2_000 },
      { id: 'flat', distanceM: 13_000, ascentM: 80, durationS: 2_800 },
    ],
    userSelectedPriority: 'shorter', flatnessRequested: true,
  });
  expect(scored.find(item => item.id === 'short')!.score).toBeGreaterThan(scored.find(item => item.id === 'flat')!.score);
  expect(scored.every(item => item.scoreBreakdown.flatness !== null)).toBe(true);
  expect(() => scoreRouteCandidates({
    candidates: [
      { id: 'a', distanceM: 10_000, ascentM: null, durationS: 2_000 },
      { id: 'b', distanceM: 12_000, ascentM: null, durationS: 2_400 },
    ],
    userSelectedPriority: 'flatter', flatnessRequested: true,
  })).toThrow('ROUTE_AI_PRIMARY_METRIC_UNKNOWN');
});
