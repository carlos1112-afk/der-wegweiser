import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './SearchInput.module.css';

export interface SearchResult {
  lat: number;
  lng: number;
  label: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

interface SearchInputProps {
  onSelect: (result: SearchResult) => void;
  placeholder?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  onSelect,
  placeholder = 'Ziel eingeben...',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchResults = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setIsOpen(false);
      setError(null);
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`;
      const response = await fetch(url, {
        signal: abortRef.current.signal,
        headers: {
          'User-Agent': 'Der-Wegweiser-App/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: NominatimResult[] = await response.json();

      if (data.length === 0) {
        setError('Keine Ergebnisse gefunden.');
        setResults([]);
        setIsOpen(true);
      } else {
        setResults(data);
        setError(null);
        setIsOpen(true);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError('Netzwerkfehler. Bitte erneut versuchen.');
      setResults([]);
      setIsOpen(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      setError(null);
      setIsLoading(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      fetchResults(query);
    }, 400);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, fetchResults]);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setResults([]);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: NominatimResult) => {
    const result: SearchResult = {
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      label: item.display_name,
    };
    setQuery(item.display_name.split(',')[0]);
    setIsOpen(false);
    setResults([]);
    onSelect(result);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setError(null);
  };

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.inputWrapper}>
        <span className={styles.searchIcon}>⌕</span>
        <input
          type="text"
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Zielsuche"
        />
        {isLoading && <span className={styles.spinner} aria-label="Laden" />}
        {!isLoading && query && (
          <button className={styles.clearBtn} onClick={handleClear} aria-label="Eingabe löschen">
            ✕
          </button>
        )}
      </div>

      {isOpen && (
        <ul className={styles.dropdown} role="listbox">
          {error ? (
            <li className={styles.errorItem}>{error}</li>
          ) : (
            results.map((item, idx) => (
              <li
                key={idx}
                className={styles.resultItem}
                role="option"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(item);
                }}
              >
                <span className={styles.resultPin}>📍</span>
                <span className={styles.resultLabel}>{item.display_name}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};
