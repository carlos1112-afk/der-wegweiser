import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { SearchInput } from '../Search/SearchInput';
import type { SearchResult } from '../Search/SearchInput';
import { PremiumRouteService, type RoutePriority } from '../../services/premiumRouteService';

interface AdvancedRoutePlannerProps {
  signedIn: boolean;
  onGenerate: (destination: SearchResult, priority: RoutePriority, stops: SearchResult[]) => Promise<boolean>;
  onClose: () => void;
}

export const AdvancedRoutePlanner: React.FC<AdvancedRoutePlannerProps> = ({ signedIn, onGenerate, onClose }) => {
  const [destination, setDestination] = useState<SearchResult | null>(null);
  const [stops, setStops] = useState<Array<{ id: string; value: SearchResult | null }>>([]);
  const [priority, setPriority] = useState<Exclude<RoutePriority, null>>('shorter');
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void PremiumRouteService.isAvailable().then(value => { if (active) setAvailable(value); })
      .catch(() => { if (active) setAvailable(false); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  const submit = async () => {
    if (!destination || stops.some(stop => stop.value === null) || generating || !available || !signedIn) return;
    setGenerating(true); setError(null);
    try {
      const succeeded = await onGenerate(destination, priority, stops.map(stop => stop.value!).filter(Boolean));
      if (!succeeded) setError('Die Strecke wurde nicht bereitgestellt. Prüfe den Hinweis in der Karte und versuche es nach Behebung erneut.');
    } catch (reason: any) {
      if (reason?.name !== 'AbortError') setError(reason?.message ?? 'Premiumplanung fehlgeschlagen.');
    } finally { setGenerating(false); }
  };

  return <div role="dialog" aria-modal="true" aria-labelledby="advanced-route-title" style={{ position: 'fixed', inset: 0, zIndex: 3100, background: 'rgba(5,10,18,.96)', overflowY: 'auto', padding: 'max(18px, env(safe-area-inset-top)) 16px max(20px, env(safe-area-inset-bottom))' }}>
    <section className="glass-panel" style={{ width: '100%', maxWidth: '620px', margin: '0 auto', padding: 'clamp(18px, 5vw, 28px)', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <h2 id="advanced-route-title" style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>Persönliche Routenplanung <span style={{ color: 'var(--accent-gold)' }}>Premium</span></h2>
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '.82rem' }}>Die KI bewertet echte, vom Straßenrouter berechnete Varianten.</p>
        </div>
        <button className="btn-cyberpunk btn-icon-ghost" onClick={onClose} aria-label="Schließen" style={{ padding: '8px', borderRadius: '50%' }}><X size={18} /></button>
      </header>
      <label style={{ color: '#fff' }}>Ziel
        <SearchInput placeholder="Ziel suchen oder Koordinaten eingeben" onSelect={setDestination} />
      </label>
      {destination && <p style={{ color: 'var(--text-muted)', margin: 0 }}>Ausgewähltes Ziel: {destination.label}</p>}
      <fieldset style={{ border: '1px solid rgba(255,255,255,.18)', borderRadius: 12, padding: 12 }}>
        <legend style={{ color: '#fff' }}>Benannte Zwischenstopps (Premium)</legend>
        {stops.map((stop, index) => <div key={stop.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <div><SearchInput placeholder={`Zwischenstopp ${index + 1} suchen`} onSelect={value => setStops(current => current.map(item => item.id === stop.id ? { ...item, value } : item))} />
            {stop.value && <small style={{ color: 'var(--text-muted)' }}>Reihenfolge {index + 1}: {stop.value.label}</small>}</div>
          <button type="button" onClick={() => setStops(current => current.filter(item => item.id !== stop.id))} aria-label={`Zwischenstopp ${index + 1} entfernen`}>Entfernen</button>
        </div>)}
        <button type="button" disabled={stops.length >= 5 || generating} onClick={() => setStops(current => [...current, { id: crypto.randomUUID(), value: null }])}>Zwischenstopp hinzufügen ({stops.length}/5)</button>
        {stops.some(stop => stop.value === null) && <p role="status" style={{ color: 'var(--text-muted)', marginBottom: 0 }}>Bitte jeden hinzugefügten Zwischenstopp auswählen oder entfernen.</p>}
      </fieldset>
      <label style={{ color: '#fff' }}>Deine Hauptpriorität
        <select value={priority} onChange={event => setPriority(event.target.value as Exclude<RoutePriority, null>)} style={{ display: 'block', width: '100%', minHeight: 44, marginTop: 8 }}>
          <option value="shorter">Kürzere Strecke</option>
          <option value="flatter">Weniger Höhenmeter</option>
          <option value="faster">Kürzere Fahrzeit</option>
        </select>
      </label>
      <p role="status" style={{ color: 'var(--text-muted)', lineHeight: 1.55, margin: 0 }}>
        {checking ? 'Premiumfähigkeit wird geprüft …' : !available
          ? 'Premium ist in dieser Umgebung noch nicht freigegeben. Es wird keine Anfrage an einen KI-Anbieter gesendet.'
          : !signedIn ? 'Für die persönliche Planung bitte zuerst anmelden.'
            : 'Die Gewichtung nutzt deine gewählte Priorität (50 %), Distanz/Fahrzeit (30 %) und – wenn ausdrücklich gewünscht und messbar – Flachheit (20 %). Oberfläche, Freitext, Akku und Fahrhistorie werden noch nicht gewertet. Diese Felder werden nicht übertragen.'}
      </p>
      {error && <p role="alert" style={{ color: '#ff8b8b', margin: 0 }}>{error}</p>}
      <button type="button" className="btn-cyberpunk" onClick={() => void submit()} disabled={!available || checking || !signedIn || !destination || stops.some(stop => stop.value === null) || generating}
        style={{ minHeight: '48px', justifyContent: 'center', opacity: !available || checking || !signedIn || !destination || stops.some(stop => stop.value === null) || generating ? .55 : 1 }}>
        {generating ? 'Varianten werden berechnet …' : 'Preis ansehen und Strecke planen'}
      </button>
      <button type="button" className="btn-cyberpunk" onClick={onClose} style={{ minHeight: '44px', justifyContent: 'center' }}>Zurück</button>
    </section>
  </div>;
};
