import { defineSecret, defineString } from 'firebase-functions/params';
import { VertexAI } from '@google-cloud/vertexai';

export type RouteAiProvider = 'vertex' | 'gemini' | 'openai' | 'anthropic';
export interface RouteAiChoice {
  candidateId: string;
  reason: string;
}
export interface RouteAiCandidateFacts {
  id: string;
  distanceM: number;
  ascentM: number | null;
  durationS: number | null;
}
export interface RouteAiInput {
  candidates: readonly RouteAiCandidateFacts[];
  userSelectedPriority: 'shorter' | 'flatter' | 'faster' | null;
  flatnessRequested: boolean;
  scoredCandidates: readonly { id: string; score: number; scoreBreakdown: { primary: number; efficiency: number; flatness: number | null } }[];
}

export class RouteAiProviderError extends Error {
  readonly retryable: boolean;
  constructor(readonly status: number) {
    super(`ROUTE_AI_UPSTREAM_${status}`);
    this.name = 'RouteAiProviderError';
    this.retryable = status === 408 || status === 429 || status >= 500;
  }
}

export const routeAiProvider = defineString('ROUTE_AI_PROVIDER', { default: '' });
export const routeAiModel = defineString('ROUTE_AI_MODEL', { default: '' });
export const routePremiumRelease = defineString('ROUTING_PREMIUM_RELEASED', { default: 'false' });
// One server secret is bound to the selected provider. This keeps deployment setup explicit
// and avoids binding unused credentials to the callable.
export const routeAiApiKey = defineSecret('ROUTE_AI_API_KEY');
export const routeAiSecrets = [routeAiApiKey];

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    candidateId: { type: 'string' },
    reason: { type: 'string' },
  },
  required: ['candidateId', 'reason'], additionalProperties: false,
} as const;

function boundedText(value: unknown, maxBytes = 128_000): string {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > maxBytes) throw new Error('ROUTE_AI_INVALID_RESPONSE');
  return value;
}
function parseChoice(raw: string, input: RouteAiInput): RouteAiChoice {
  const value = JSON.parse(boundedText(raw, 32_000)) as any;
  if (!input.candidates.some(candidate => candidate.id === value?.candidateId)
    || typeof value.reason !== 'string' || !value.reason.trim() || value.reason.length > 500) {
    throw new Error('ROUTE_AI_INVALID_RESPONSE');
  }
  const highest = Math.max(...input.scoredCandidates.map(candidate => candidate.score));
  const allowed = input.scoredCandidates.filter(candidate => highest - candidate.score <= 0.5).map(candidate => candidate.id);
  if (!allowed.includes(value.candidateId)) throw new Error('ROUTE_AI_CHOICE_VIOLATES_WEIGHTING');
  return { candidateId: value.candidateId, reason: value.reason.trim() };
}
function promptFor(input: RouteAiInput): string {
  // The model sees only verified route metrics and the user's explicit priority.
  return JSON.stringify({ task: 'Choose one computed bicycle route candidate. Never invent geometry, POIs, measurements, or constraints.',
    rules: ['Hard safety and waypoint validation happened outside this model and cannot be overridden.',
      'Only score evidence present in candidate facts. Missing ascent or duration is unknown, not zero.',
      'The server calculated the fixed balanced scores. Select only a candidate with the highest score; ties within 0.5 points are allowed.',
      'Return one candidateId from the provided set and short factual explanation in German.',
      'Do not infer preferences from behavior or profile fields not shown here.'],
    userSelectedPriority: input.userSelectedPriority, flatnessRequested: input.flatnessRequested,
    candidates: input.candidates.map(candidate => ({ ...candidate,
      score: input.scoredCandidates.find(scored => scored.id === candidate.id)?.score,
      scoreBreakdown: input.scoredCandidates.find(scored => scored.id === candidate.id)?.scoreBreakdown })) });
}
function lowerIsBetter(values: readonly number[]): number[] {
  const min = Math.min(...values), max = Math.max(...values);
  return values.map(value => max === min ? 100 : 100 * (max - value) / (max - min));
}
export function scoreRouteCandidates(input: Omit<RouteAiInput, 'scoredCandidates'>): RouteAiInput['scoredCandidates'] {
  const candidates = input.candidates;
  if (candidates.length < 2) throw new Error('ROUTE_AI_NOT_ENOUGH_CANDIDATES');
  const key = input.userSelectedPriority === 'faster' ? 'durationS' : input.userSelectedPriority === 'flatter' ? 'ascentM' : 'distanceM';
  const primaryValues = candidates.map(candidate => candidate[key]);
  if (primaryValues.some(value => value === null)) throw new Error('ROUTE_AI_PRIMARY_METRIC_UNKNOWN');
  const primary = lowerIsBetter(primaryValues as number[]);
  const efficiencyAxes: number[][] = [];
  if (key !== 'distanceM' && candidates.every(candidate => candidate.distanceM !== null)) efficiencyAxes.push(lowerIsBetter(candidates.map(candidate => candidate.distanceM)));
  if (key !== 'durationS' && candidates.every(candidate => candidate.durationS !== null)) efficiencyAxes.push(lowerIsBetter(candidates.map(candidate => candidate.durationS!)));
  const efficiency = candidates.map((_, index) => efficiencyAxes.length
    ? efficiencyAxes.reduce((sum, axis) => sum + axis[index], 0) / efficiencyAxes.length : 100);
  const flatKnown = input.flatnessRequested && candidates.every(candidate => candidate.ascentM !== null);
  const flatness = flatKnown ? lowerIsBetter(candidates.map(candidate => candidate.ascentM!)) : candidates.map(() => null);
  const flatWeight = flatKnown && key !== 'ascentM' ? 0.2 : 0;
  const efficiencyWeight = 0.3 + (0.2 - flatWeight);
  return candidates.map((candidate, index) => ({ id: candidate.id,
    score: 0.5 * primary[index] + efficiencyWeight * efficiency[index] + (flatWeight ? flatWeight * flatness[index]! : 0),
    scoreBreakdown: { primary: primary[index], efficiency: efficiency[index], flatness: flatness[index] } }));
}
async function readJson(response: Response): Promise<any> {
  if (!response.ok) throw new RouteAiProviderError(response.status);
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > 64_000) throw new Error('ROUTE_AI_RESPONSE_TOO_LARGE');
  return JSON.parse(text);
}
async function requestJson(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20_000);
  try {
    return await readJson(await fetch(url, { method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }));
  } finally { clearTimeout(timer); }
}

/** Server-side only, provider pinned by operator config; there is no silent cross-provider fallback. */
export async function chooseRouteCandidate(input: RouteAiInput, pinned?: { provider: RouteAiProvider; model: string }): Promise<{ choice: RouteAiChoice; provider: RouteAiProvider; model: string }> {
  const provider = (pinned?.provider ?? routeAiProvider.value()) as RouteAiProvider;
  const model = pinned?.model ?? routeAiModel.value();
  if (!model || !['vertex', 'gemini', 'openai', 'anthropic'].includes(provider)) throw new Error('ROUTE_AI_NOT_CONFIGURED');
  const prompt = promptFor(input);
  let raw: string;
  if (provider === 'vertex') {
    const ai = new VertexAI({ project: process.env.GCLOUD_PROJECT || 'der-wegweiser', location: 'europe-west3' });
    const generativeModel = ai.getGenerativeModel({ model, generationConfig: {
      responseMimeType: 'application/json', responseSchema: OUTPUT_SCHEMA as any, temperature: 0, maxOutputTokens: 512,
    } });
    const result = await generativeModel.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    raw = result.response.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('') ?? '';
  } else if (provider === 'gemini') {
    const key = routeAiApiKey.value(); if (!key) throw new Error('ROUTE_AI_CREDENTIAL_MISSING');
    const response = await requestJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { 'x-goog-api-key': key }, { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: {
        responseMimeType: 'application/json', responseSchema: OUTPUT_SCHEMA, temperature: 0, maxOutputTokens: 512,
      } });
    raw = response.candidates?.[0]?.content?.parts?.map((part: any) => part.text ?? '').join('') ?? '';
  } else if (provider === 'openai') {
    const key = routeAiApiKey.value(); if (!key) throw new Error('ROUTE_AI_CREDENTIAL_MISSING');
    const response = await requestJson('https://api.openai.com/v1/chat/completions', { Authorization: `Bearer ${key}` }, {
      model, temperature: 0, max_tokens: 512, messages: [{ role: 'system', content: 'Select only among validated bicycle route candidates.' }, { role: 'user', content: prompt }],
      response_format: { type: 'json_schema', json_schema: { name: 'route_candidate_choice', strict: true, schema: OUTPUT_SCHEMA } },
    });
    raw = response.choices?.[0]?.message?.content ?? '';
  } else {
    const key = routeAiApiKey.value(); if (!key) throw new Error('ROUTE_AI_CREDENTIAL_MISSING');
    const response = await requestJson('https://api.anthropic.com/v1/messages', {
      'x-api-key': key, 'anthropic-version': '2023-06-01',
    }, { model, max_tokens: 512, temperature: 0, system: 'Select only among validated bicycle route candidates.',
      messages: [{ role: 'user', content: prompt }], output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    });
    raw = response.content?.find((part: any) => part.type === 'text')?.text ?? '';
  }
  return { choice: parseChoice(raw, input), provider, model };
}
