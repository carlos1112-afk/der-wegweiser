import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../firebase';
import { CONSENT_VERSION, ConsentService } from './consentService';
import { isCoordinate } from '../../functions/src/routing/geometry';
import { RoutingError } from '../types/routing';
export interface PlaceResult { id?: string; lat: number; lng: number; label: string }
export class PlaceSearchService {
  static async search(query: string, signal: AbortSignal): Promise<PlaceResult[]> {
    if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
    if (!ConsentService.allowsEssential) throw new RoutingError('CONSENT_REQUIRED');
    // Explicit coordinate search works without a new geocoding request.
    const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(query);
    if (match) {
      const position = { lat: Number(match[1]), lng: Number(match[2]) };
      if (!isCoordinate(position)) throw new RoutingError('INVALID_REQUEST');
      return [{ ...position, label: query.trim(), id: `coordinate:${position.lat},${position.lng}` }];
    }
    if (!query.trim() || query.length > 100 || Array.from(query).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new RoutingError('INVALID_REQUEST');
    if (!functions) throw new RoutingError('UNAVAILABLE');
    const revision = ConsentService.getRevision(), uid = auth.currentUser?.uid ?? null;
    const search = httpsCallable<{ query: string; consentVersion: number }, { results: PlaceResult[] }>(functions, 'searchPlaces', { timeout: 10000 });
    const response = await search({ query: query.trim(), consentVersion: CONSENT_VERSION });
    // Firebase callables expose no AbortSignal transport option. Invalidate late results explicitly.
    if (signal.aborted || revision !== ConsentService.getRevision() || !ConsentService.allowsEssential || uid !== (auth.currentUser?.uid ?? null)) throw new DOMException('Abgebrochen', 'AbortError');
    const results = response.data?.results;
    if (!Array.isArray(results) || results.length > 5 || !results.every(item => isCoordinate(item) && typeof item.label === 'string' && item.label.length > 0 && item.label.length <= 1000 && typeof item.id === 'string')) throw new RoutingError('UNAVAILABLE');
    return results;
  }
}
