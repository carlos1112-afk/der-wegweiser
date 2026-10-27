import { useEffect, useRef } from 'react';
import { isValidatedRoute } from '../../types/routing';
import type { Route } from '../../types/navigation';
import type { ModelId } from '../../services/aiAssistantService';
interface Props { route: Route; onAcceptRoute: (route: Route) => void; onRegenerate: (modelId: ModelId) => void; onClose: () => void }
export const AnticipationModal: React.FC<Props> = ({ route, onAcceptRoute, onClose }) => {
  const valid = isValidatedRoute(route.validatedRoute) ? route.validatedRoute : null;
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div ref={dialog} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); close.current(); }
    if (event.key === 'Tab') {
      const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }} role="dialog" aria-modal="true" aria-label="Routenvorschau" style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,.85)', zIndex: 2200, display: 'grid', placeItems: 'center', padding: 20 }}>
    <section className="glass-panel" style={{ padding: 24, maxWidth: 560, width: '100%' }}>
      <h2>{route.title}</h2><p>{route.aiStory}</p>
      <dl><dt>Distanz</dt><dd>{route.distanceKm.toFixed(1)} km</dd>
        <dt>Anstieg</dt><dd>{route.elevationGainM === null ? 'Unbekannt' : `${route.elevationGainM} m`}</dd>
        <dt>Akku und Oberflächen</dt><dd>Ohne belastbare Quelldaten unbekannt.</dd>
        <dt>Routenart</dt><dd>{valid ? valid.guidanceCapability === 'track' ? 'Trackanzeige · keine Abbiegeführung' : 'Mit geprüften Abbiegehinweisen' : 'Alte oder importierte Spur · ungeprüft'}</dd>
      </dl>
      <button type="button" className="btn-cyberpunk" disabled={!valid} onClick={() => onAcceptRoute(route)}>{valid?.guidanceCapability === 'turn_by_turn' ? 'Navigation starten' : 'Track übernehmen'}</button>
      <button type="button" onClick={onClose}>Schließen</button>
    </section>
  </div>;
};
