import React from 'react';
import {
  X, Route, UploadCloud, Play, Sun, Moon, Volume2,
  BarChart3, Camera, Gamepad2, Sparkles, ShieldCheck, Bluetooth
} from 'lucide-react';

interface BurgerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  isSunlightMode: boolean;
  onToggleSunlightMode: () => void;
  onOpenGpx: () => void;
  onOpenVoice: () => void;
  onOpenAnalytics: () => void;
  onOpenScanner: () => void;
  onOpenLounge: () => void;
  onOpenAnticipation: () => void;
  onOpenLegal: () => void;
  onStartDemo: () => void;
  onOpenBle?: () => void;
  isBleConnected?: boolean;
}

export const BurgerMenu: React.FC<BurgerMenuProps> = ({
  isOpen,
  onClose,
  isSunlightMode,
  onToggleSunlightMode,
  onOpenGpx,
  onOpenVoice,
  onOpenAnalytics,
  onOpenScanner,
  onOpenLounge,
  onOpenAnticipation,
  onOpenLegal,
  onStartDemo,
  onOpenBle,
  isBleConnected = false,
}) => {
  if (!isOpen) return null;

  return (
    <>
      <div 
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3000,
          backdropFilter: 'blur(2px)'
        }}
        onClick={onClose}
      />
      <div 
        className="glass-panel"
        style={{
          position: 'fixed',
          top: 0, left: 0, bottom: 0,
          width: '280px',
          maxWidth: '80vw',
          zIndex: 3001,
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          overflowY: 'auto',
          animation: 'slideInLeft 0.3s ease',
          backgroundColor: 'rgba(10, 16, 28, 0.95)',
          borderRight: '1px solid var(--accent-cyan)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--accent-cyan)', margin: 0, fontWeight: 'bold' }}>Menü</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Core Actions */}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Navigation</div>
          
          <button className="btn-cyberpunk btn-cyan" style={{ justifyContent: 'flex-start' }} onClick={() => { onClose(); }}>
            <Route size={18} /> Route planen
          </button>
          <button className="btn-cyberpunk" style={{ justifyContent: 'flex-start' }} onClick={() => { onClose(); onOpenGpx(); }}>
            <UploadCloud size={18} /> GPX Import
          </button>
          <button className="btn-cyberpunk" style={{ justifyContent: 'flex-start' }} onClick={() => { onClose(); onStartDemo(); }}>
            <Play size={18} /> Demo-Fahrt
          </button>
          <button className="btn-cyberpunk" style={{ justifyContent: 'flex-start' }} onClick={() => { onClose(); onOpenAnticipation(); }}>
            <Sparkles size={18} /> KI Heute-Tour
          </button>

          {/* E-Bike */}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '16px', marginBottom: '4px' }}>E-Bike</div>

          {onOpenBle && (
            <button
              className={`btn-cyberpunk ${isBleConnected ? 'btn-cyan' : ''}`}
              style={{ justifyContent: 'flex-start' }}
              onClick={() => { onClose(); onOpenBle(); }}
            >
              <Bluetooth size={18} />
              {isBleConnected ? 'E-Bike verbunden ✓' : 'E-Bike verbinden'}
            </button>
          )}

          {/* Settings & Tools */}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '16px', marginBottom: '4px' }}>Einstellungen & Tools</div>
          
          <button className="btn-cyberpunk" style={{ justifyContent: 'flex-start' }} onClick={() => { onClose(); onToggleSunlightMode(); }}>
            {isSunlightMode ? <Moon size={18} /> : <Sun size={18} />} Sonnenlicht Modus
          </button>
          <button className="btn-cyberpunk" style={{ justifyContent: 'flex-start' }} onClick={() => { onClose(); onOpenVoice(); }}>
            <Volume2 size={18} /> Stimme & Audio
          </button>
          
          <button className="btn-cyberpunk" style={{ justifyContent: 'flex-start' }} onClick={() => { onClose(); onOpenAnalytics(); }}>
            <BarChart3 size={18} /> Touren-Historie
          </button>

          {/* Community */}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '16px', marginBottom: '4px' }}>Community</div>

          <button className="btn-cyberpunk" style={{ justifyContent: 'flex-start' }} onClick={() => { onClose(); onOpenScanner(); }}>
            <Camera size={18} /> Ladesäulen-Scanner
          </button>
          <button className="btn-cyberpunk btn-gold" style={{ justifyContent: 'flex-start' }} onClick={() => { onClose(); onOpenLounge(); }}>
            <Gamepad2 size={18} /> Lade-Lounge
          </button>

          {/* Legal */}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '16px', marginBottom: '4px' }}>Rechtliches</div>

          <button className="btn-cyberpunk" style={{ justifyContent: 'flex-start' }} onClick={() => { onClose(); onOpenLegal(); }}>
            <ShieldCheck size={18} /> AGB & Datenschutz
          </button>

        </div>
      </div>
    </>
  );
};
