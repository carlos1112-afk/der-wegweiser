import { useState } from 'react';
import { Sparkles, Navigation, Battery, Mountain, CheckCircle2, RefreshCw, Send, ChevronDown, Bot } from 'lucide-react';
import type { Route } from '../../types/navigation';
import { BoschFlowService } from '../../services/boschFlowService';
import { agentRegistry, DEFAULT_MODEL } from '../../services/aiAssistantService';
import type { ModelId } from '../../services/aiAssistantService';

interface AnticipationModalProps {
  route: Route;
  onAcceptRoute: (route: Route) => void;
  onRegenerate: (modelId: ModelId) => void;
  onClose: () => void;
}

const tierColors: Record<string, string> = {
  free: '#4ade80',      // green — no cost
  cloud: '#38bdf8',     // sky blue — GCP credits
  pro: 'var(--accent-cyan)',
  flash: '#a78bfa',     // purple
  lite: '#6ee7b7',      // teal
};

export const AnticipationModal: React.FC<AnticipationModalProps> = ({
  route,
  onAcceptRoute,
  onRegenerate,
  onClose,
}) => {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [boschMessage, setBoschMessage] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelId>(DEFAULT_MODEL);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleRegenerateClick = () => {
    setIsRegenerating(true);
    setDropdownOpen(false);
    onRegenerate(selectedModel);
    setTimeout(() => setIsRegenerating(false), 800);
  };

  const handlePushToBoschDisplay = async () => {
    setBoschMessage('Sende Route an Bosch Kiox/Display...');
    const result = await BoschFlowService.pushRouteToBoschDisplay(route);
    setBoschMessage(result.message);
  };

  const currentAgent = agentRegistry[selectedModel];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 8, 15, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={() => setDropdownOpen(false)}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: '560px',
          width: '100%',
          padding: '28px',
          border: '1px solid var(--accent-cyan)',
          boxShadow: 'var(--glow-cyan)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div className="glass-pill" style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} className="glow-text-cyan" />
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
              ANTIZIPIERTE HEUTE-TOUR
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
          >
            ✕
          </button>
        </div>

        {/* Route Title & AI Rationale */}
        <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '8px' }} className="glow-text-cyan">
          {route.title}
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.5', marginBottom: '8px' }}>
          {route.aiStory}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          <Sparkles size={12} color="var(--accent-cyan)" />
          <span>🤖 KI-generierte Tourenanalyse &amp; Streckenbeschreibung (Gemini 2.0 Flash) gem. Art. 50 EU AI Act</span>
        </div>

        {/* Scout Mission Banner */}
        {route.isScoutMission && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(255, 183, 0, 0.12)',
              borderRadius: '12px',
              border: '1px solid var(--accent-gold)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#fff' }}>
              <span style={{ fontSize: '1.2rem' }}>🗺️</span>
              <div>
                <strong style={{ color: 'var(--accent-gold)' }}>Karten-Scout Modus Aktiv:</strong>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Aktualisiert veraltete Sektoren &amp; Topographie-Güten
                </div>
              </div>
            </div>
            <span className="glow-text-gold" style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
              🪙 +{route.scoutBountyTokens || 15} Bonus
            </span>
          </div>
        )}

        {/* Route Stats Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginBottom: '20px',
            padding: '14px',
            backgroundColor: 'rgba(10, 15, 25, 0.6)',
            borderRadius: '12px',
            border: '1px solid rgba(0, 240, 255, 0.15)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <Navigation size={14} /> Distanz
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '4px' }}>
              {route.distanceKm} km
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <Mountain size={14} /> Steigung
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '4px' }}>
              {route.elevationGainM} m
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <Battery size={14} /> Akku
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '4px' }} className="glow-text-green">
              ~{route.estimatedBatteryConsumptionWh} Wh
            </div>
          </div>
        </div>

        {/* ── AI Agent Selector ────────────────────────────── */}
        <div style={{ marginBottom: '20px', position: 'relative' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Bot size={13} /> KI-AGENT WÄHLEN
          </div>

          {/* Selected Agent Button */}
          <button
            onClick={(e) => { e.stopPropagation(); setDropdownOpen((o) => !o); }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: 'rgba(10, 15, 25, 0.7)',
              border: `1px solid ${tierColors[currentAgent.tier]}`,
              borderRadius: '10px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.1rem' }}>{currentAgent.icon}</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: tierColors[currentAgent.tier] }}>
                  {currentAgent.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {currentAgent.description}
                </div>
              </div>
            </div>
            <ChevronDown
              size={16}
              style={{
                color: 'var(--text-muted)',
                transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
            />
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 8px)',
                left: 0,
                right: 0,
                backgroundColor: 'rgba(5, 10, 20, 0.98)',
                border: '1px solid rgba(0, 240, 255, 0.2)',
                borderRadius: '12px',
                overflow: 'hidden',
                zIndex: 10,
                boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
              }}
            >
              {(Object.entries(agentRegistry) as [ModelId, typeof agentRegistry[ModelId]][]).map(([id, agent]) => (
                <button
                  key={id}
                  onClick={() => { setSelectedModel(id); setDropdownOpen(false); }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    background: id === selectedModel ? 'rgba(0,240,255,0.08)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = id === selectedModel ? 'rgba(0,240,255,0.08)' : 'transparent')}
                >
                  <span style={{ fontSize: '1.2rem', minWidth: '24px' }}>{agent.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: tierColors[agent.tier] }}>
                      {agent.label}
                      {id === selectedModel && (
                        <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>✓ AKTIV</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{agent.description}</div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 'bold',
                      padding: '2px 7px',
                      borderRadius: '20px',
                      border: `1px solid ${tierColors[agent.tier]}`,
                      color: tierColors[agent.tier],
                      textTransform: 'uppercase',
                    }}
                  >
                    {agent.tier}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* ─────────────────────────────────────────────────── */}

        {/* Bosch Sync Notification Banner */}
        {boschMessage && (
          <div
            style={{
              marginBottom: '20px',
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 183, 0, 0.15)',
              border: '1px solid var(--accent-gold)',
              color: 'var(--accent-gold)',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              textAlign: 'center',
            }}
          >
            {boschMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            className="btn-cyberpunk"
            style={{ backgroundColor: 'transparent', borderColor: 'var(--text-muted)', color: 'var(--text-muted)' }}
            onClick={handleRegenerateClick}
          >
            <RefreshCw size={16} className={isRegenerating ? 'spin' : ''} /> Andere Route
          </button>

          <button className="btn-cyberpunk btn-gold" onClick={handlePushToBoschDisplay}>
            <Send size={16} /> Bosch Display Push
          </button>

          <button
            className="btn-cyberpunk"
            onClick={() => onAcceptRoute(route)}
            style={{ backgroundColor: 'var(--accent-cyan)', color: '#000', fontWeight: 'bold' }}
          >
            <CheckCircle2 size={18} /> Tour Starten
          </button>
        </div>
      </div>
    </div>
  );
};
