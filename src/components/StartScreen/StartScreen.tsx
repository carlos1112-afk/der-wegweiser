import React from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, LogIn, LogOut, Bluetooth, Battery, Trophy, Play } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { LiveBikeTelemetry } from '../../types/navigation';

interface StartScreenProps {
  onStart: () => void;
  onOpenSettings: () => void;
  onOpenLogin: () => void;
  tokenBalance: number;
  telemetry: LiveBikeTelemetry;
  currentUser: User | null;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onStart,
  onOpenSettings,
  onOpenLogin,
  tokenBalance,
  telemetry,
  currentUser,
}) => {
  const { t } = useTranslation();
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2999,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-primary)',
        padding: '24px 20px',
        overflowY: 'auto',
      }}
    >
      {/* Top Utility Bar: Settings + Login */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          className="btn-cyberpunk btn-icon-ghost"
          onClick={onOpenLogin}
          style={{ padding: '8px', borderRadius: '50%' }}
          title={currentUser ? t('start.loggedInAs', { name: currentUser.email ?? currentUser.displayName ?? 'Nutzer' }) : t('start.login')}
        >
          {currentUser ? <LogOut size={18} /> : <LogIn size={18} />}
        </button>
        <button
          className="btn-cyberpunk btn-icon-ghost"
          onClick={onOpenSettings}
          style={{ padding: '8px', borderRadius: '50%' }}
          title={t('start.settings')}
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Branding */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '10vh', marginBottom: '32px' }}>
        <img src="/icon-192.png" alt={t('app.title')} width={88} height={88} style={{ borderRadius: '22px', boxShadow: 'var(--glow-cyan)' }} />
        <h1
          style={{
            marginTop: '16px',
            fontSize: '2rem',
            fontFamily: "'Chakra Petch', monospace",
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '0.5px',
            textAlign: 'center',
          }}
        >
          {t('app.title')}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', textAlign: 'center' }}>
          {t('app.tagline')}
        </p>
      </div>

      {/* Dashboard Widget */}
      <div
        className="glass-panel"
        style={{
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          marginBottom: '32px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bluetooth size={18} className={telemetry.isConnected ? 'glow-text-green' : undefined} style={!telemetry.isConnected ? { color: 'var(--text-muted)' } : undefined} />
            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: telemetry.isConnected ? undefined : 'var(--text-muted)' }} className={telemetry.isConnected ? 'glow-text-green' : undefined}>
              {telemetry.isConnected ? t('start.ebikeConnected') : t('start.ebikeDisconnected')}
            </span>
          </div>
          {telemetry.isConnected && typeof telemetry.batteryPercent === 'number' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Battery size={16} className="glow-text-green" />
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }} className="glow-text-green">
                {telemetry.batteryPercent}%
              </span>
            </div>
          )}
        </div>

        <div style={{ height: '1px', backgroundColor: 'var(--border-glass)' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={18} className="glow-text-gold" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {t('start.rank')}: <strong style={{ color: '#ffffff' }}>E-Bike Scout</strong>
            </span>
          </div>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }} className="glow-text-gold">
            🪙 {tokenBalance} {t('start.tokens')}
          </span>
        </div>
      </div>

      {/* Spacer pushes CTA toward the bottom on tall screens */}
      <div style={{ flex: 1 }} />

      <button
        className="btn-cyberpunk btn-cyan"
        onClick={onStart}
        style={{
          width: '100%',
          padding: '18px',
          borderRadius: '16px',
          fontSize: '1.05rem',
          justifyContent: 'center',
          marginBottom: '8px',
        }}
      >
        <Play size={20} /> {t('start.start')}
      </button>
    </div>
  );
};
