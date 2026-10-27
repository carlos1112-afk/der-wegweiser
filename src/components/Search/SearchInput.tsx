import { useEffect, useRef, useState } from 'react';
import styles from './SearchInput.module.css';
import { searchQuerySchema } from '../../utils/validation';
import { PlaceSearchService } from '../../services/placeSearchService';
import { ConsentService } from '../../services/consentService';
import type { PlaceResult } from '../../services/placeSearchService';
export interface SearchResult { lat: number; lng: number; label: string }
interface SearchInputProps { onSelect: (result: SearchResult) => void; placeholder?: string; focusRequest?: number }
export const SearchInput: React.FC<SearchInputProps> = ({ onSelect, placeholder = 'Ziel eingeben...', focusRequest = 0 }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const invalidate = () => { generation.current++; abortRef.current?.abort(); setIsLoading(false); setResults([]); setError(null); setIsOpen(false); };
  useEffect(() => { if (focusRequest > 0) inputRef.current?.focus(); }, [focusRequest]);
  useEffect(() => () => { generation.current++; abortRef.current?.abort(); }, []);
  useEffect(() => ConsentService.onChange(() => { invalidate(); }), []);
  const submit = async () => {
    invalidate();
    const parsed = searchQuerySchema.safeParse(query);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Ungültiger Suchbegriff.'); setIsOpen(true); return; }
    const current = generation.current, controller = new AbortController(); abortRef.current = controller;
    setIsLoading(true);
    try {
      const places = await PlaceSearchService.search(parsed.data, controller.signal);
      if (current !== generation.current || controller.signal.aborted) return;
      setResults(places); setIsOpen(true); if (!places.length) setError('Keine Ergebnisse gefunden.');
    } catch (error: any) {
      if (current !== generation.current || controller.signal.aborted || error?.name === 'AbortError') return;
      setError(error?.code === 'CONSENT_REQUIRED' ? 'Bitte zuerst der Standortverarbeitung zustimmen.' : 'Zielsuche derzeit nicht verfügbar. Koordinaten können weiterhin eingegeben werden.'); setIsOpen(true);
    } finally { if (current === generation.current) setIsLoading(false); }
  };
  const select = (item: PlaceResult) => { invalidate(); setQuery(item.label.split(',')[0]); onSelect(item); };
  return <div className={styles.container}>
    <form className={styles.inputWrapper} onSubmit={event => { event.preventDefault(); void submit(); }}>
      <span className={styles.searchIcon} aria-hidden="true">⌕</span>
      <input ref={inputRef} type="text" className={styles.input} value={query} onChange={event => { invalidate(); setQuery(event.target.value); }}
        onKeyDown={event => { if (event.key === 'Escape') invalidate(); }} placeholder={placeholder} autoComplete="off" spellCheck={false} aria-label="Zielsuche" />
      <button type="submit" disabled={isLoading} aria-label="Ziel suchen">{isLoading ? 'Suche…' : 'Suchen'}</button>
      {query && <button type="button" className={styles.clearBtn} onClick={() => { invalidate(); setQuery(''); inputRef.current?.focus(); }} aria-label="Eingabe löschen">✕</button>}
    </form>
    {isOpen && <ul className={styles.dropdown} aria-label="Suchergebnisse">
      {error ? <li className={styles.errorItem} role="status">{error}</li> : results.map((item, index) => <li key={item.id ?? index} className={styles.resultItem}>
        <button type="button" onClick={() => select(item)}>{item.label}</button>
      </li>)}
    </ul>}
  </div>;
};
