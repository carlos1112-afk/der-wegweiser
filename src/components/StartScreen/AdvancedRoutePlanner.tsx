import React, { useState } from 'react';
import { MapPin, SlidersHorizontal, X } from 'lucide-react';
import { SearchInput, type SearchResult } from '../Search/SearchInput';
import type { SurfacePreference } from '../../types/navigation';

export interface AdvancedRouteOptions {
  via?: SearchResult;
  wishes: string;
  surfacePreference: SurfacePreference;
  avoidSteepHills: boolean;
}

interface AdvancedRoutePlannerProps {
  onClose: () => void;
  onGenerate: (destination: SearchResult, options: AdvancedRouteOptions) => void;
}

export const AdvancedRoutePlanner: React.FC<AdvancedRoutePlannerProps> = ({ onClose, onGenerate }) => {
  const [destination, setDestination] = useState<SearchResult | null>(null);
  const [via, setVia] = useState<SearchResult | null>(null);
  const [wishes, setWishes] = useState('');
  const [surfacePreference, setSurfacePreference] = useState<SurfacePreference>('any');
  const [avoidSteepHills, setAvoidSteepHills] = useState(true);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="advanced-route-title" style={{ position: 'fixed', inset: 0, zIndex: 3100, background: 'rgba(5,10,18,.96)', overflowY: 'auto', padding: 'max(18px, env(safe-area-inset-top)) 16px max(20px, env(safe-area-inset-bottom))' }}>
      <section className="glass-panel" style={{ width: '100%', maxWidth: '620px', margin: '0 auto', padding: 'clamp(18px, 5vw, 28px)', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <h2 id="advanced-route-title" style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>Erweiterte Routenplanung <span style={{ color: 'var(--accent-gold)' }}>Premium</span></h2>
            <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '.82rem' }}>Ziel und optionale Vorgaben für deine Strecke.</p>
          </div>
          <button className="btn-cyberpunk btn-icon-ghost" onClick={onClose} aria-label="Schließen" style={{ padding: '8px', borderRadius: '50%' }}><X size={18} /></button>
        </header>

        <label style={{ display: 'grid', gap: '7px', color: '#fff', fontSize: '.85rem' }}>
          Ziel <span style={{ color: 'var(--accent-gold)' }}>*</span>
          <SearchInput placeholder="Ziel suchen …" onSelect={setDestination} />
          {destination && <small style={{ color: 'var(--accent-cyan)' }}>Ziel: {destination.label}</small>}
        </label>

        <label style={{ display: 'grid', gap: '7px', color: '#fff', fontSize: '.85rem' }}>
          Bevorzugtes Zwischenziel (optional)
          <SearchInput placeholder="Ort oder Zwischenziel suchen …" onSelect={setVia} />
          {via && <small style={{ color: 'var(--accent-cyan)' }}><MapPin size={12} style={{ verticalAlign: 'middle' }} /> Über: {via.label}</small>}
        </label>

        <label style={{ display: 'grid', gap: '7px', color: '#fff', fontSize: '.85rem' }}>
          Untergrund
          <select value={surfacePreference} onChange={(event) => setSurfacePreference(event.target.value as SurfacePreference)} style={{ padding: '11px', borderRadius: '9px', color: '#fff', background: '#111c30', border: '1px solid var(--border-glass)' }}>
            <option value="any">Gemischt</option>
            <option value="asphalt">Möglichst Asphalt</option>
            <option value="gravel">Schotter bevorzugen</option>
            <option value="forest">Waldwege bevorzugen</option>
          </select>
        </label>

        <label style={{ display: 'grid', gap: '7px', color: '#fff', fontSize: '.85rem' }}>
          Wünsche an die Route
          <textarea value={wishes} onChange={(event) => setWishes(event.target.value.slice(0, 400))} maxLength={400} rows={3} placeholder="z. B. ruhige Wege, Seeufer, keine stark befahrenen Straßen" style={{ resize: 'vertical', padding: '11px', borderRadius: '9px', color: '#fff', background: '#111c30', border: '1px solid var(--border-glass)' }} />
          <small style={{ color: 'var(--text-muted)', textAlign: 'right' }}>{wishes.length}/400</small>
        </label>

        <label style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#fff', fontSize: '.85rem' }}>
          <input type="checkbox" checked={avoidSteepHills} onChange={(event) => setAvoidSteepHills(event.target.checked)} />
          Starke Steigungen vermeiden
        </label>

        <button className="btn-cyberpunk btn-cyan" disabled={!destination} onClick={() => destination && onGenerate(destination, { via: via ?? undefined, wishes: wishes.trim(), surfacePreference, avoidSteepHills })} style={{ minHeight: '48px', justifyContent: 'center', gap: '8px', opacity: destination ? 1 : .5 }}>
          <SlidersHorizontal size={18} /> KI-Premium-Route erstellen
        </button>
        <small style={{ color: 'var(--text-muted)', lineHeight: 1.45 }}>Die Routenlinie wird vom Routingdienst berechnet. Die KI ergänzt eine Beschreibung und berücksichtigt deine Vorgaben, soweit die Kartendaten das erlauben.</small>
      </section>
    </div>
  );
};
