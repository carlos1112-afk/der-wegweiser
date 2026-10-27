import React from 'react';
import { useTranslation } from 'react-i18next';
import { Map, Settings, LogIn, LogOut, Sparkles, Route, SlidersHorizontal } from 'lucide-react';
import type { User } from 'firebase/auth';

interface StartScreenProps {
  onGenerateToday: () => void;
  onStartSimpleRoute: () => void;
  onOpenAdvancedRoute: () => void;
  onOpenSettings: () => void;
  onOpenLogin: () => void;
  currentUser: User | null;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onGenerateToday,
  onStartSimpleRoute,
  onOpenAdvancedRoute,
  onOpenSettings,
  onOpenLogin,
  currentUser,
}) => {
  const { t } = useTranslation();

  return (
    <main
      aria-label="Hauptmenü"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2999,
        display: 'flex',
        flexDirection: 'column',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(0,230,163,0.12), transparent 55%), var(--bg-primary)',
        padding: 'max(18px, env(safe-area-inset-top)) 20px max(18px, env(safe-area-inset-bottom))',
        overflowY: 'auto',
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '560px', width: '100%', margin: '0 auto' }}>
        <button
          className="btn-cyberpunk btn-icon-ghost"
          onClick={onOpenLogin}
          aria-label={currentUser ? 'Abmelden oder Konto wechseln' : t('start.login')}
          title={currentUser ? (currentUser.email ?? currentUser.displayName ?? 'Konto') : t('start.login')}
          style={{ padding: '10px', borderRadius: '50%' }}
        >
          {currentUser ? <LogOut size={18} /> : <LogIn size={18} />}
        </button>
        <button className="btn-cyberpunk btn-icon-ghost" onClick={onOpenSettings} aria-label={t('start.settings')} style={{ padding: '10px', borderRadius: '50%' }}>
          <Settings size={18} />
        </button>
      </header>

      <section style={{ width: '100%', maxWidth: '560px', margin: 'clamp(22px, 7vh, 64px) auto 28px', textAlign: 'center' }}>
        <img src="/icon-192.png" alt="" width={64} height={64} style={{ borderRadius: '18px', boxShadow: 'var(--glow-cyan)' }} />
        <h1 style={{ margin: '12px 0 4px', fontSize: 'clamp(1.65rem, 6vw, 2.1rem)', fontFamily: "'Chakra Petch', monospace", fontWeight: 700, color: '#fff' }}>
          {t('app.title')}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>{t('app.tagline')}</p>
      </section>

      <nav aria-label="Routenplanung" style={{ width: '100%', maxWidth: '560px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button
          className="btn-cyberpunk btn-cyan"
          onClick={onGenerateToday}
          style={{ minHeight: '76px', borderRadius: '16px', padding: '16px 18px', justifyContent: 'flex-start', gap: '14px', textAlign: 'left' }}
        >
          <Sparkles size={24} />
          <span style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <strong style={{ fontSize: '1rem' }}>KI plant meine Strecke für heute</strong>
            <small style={{ opacity: 0.76, fontWeight: 400 }}>Start am aktuellen Standort, angepasst an deine gespeicherten Vorlieben</small>
          </span>
        </button>

        <button
          className="btn-cyberpunk"
          onClick={onStartSimpleRoute}
          style={{ minHeight: '68px', borderRadius: '16px', padding: '14px 18px', justifyContent: 'flex-start', gap: '14px', textAlign: 'left' }}
        >
          <Map size={22} />
          <span style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <strong style={{ fontSize: '0.98rem' }}>Einfache Routenplanung</strong>
            <small style={{ opacity: 0.72, fontWeight: 400 }}>Ziel suchen, dann KI- oder Offline-Route wählen</small>
          </span>
        </button>

        <button
          className="btn-cyberpunk"
          onClick={onOpenAdvancedRoute}
          style={{ minHeight: '68px', borderRadius: '16px', padding: '14px 18px', justifyContent: 'flex-start', gap: '14px', textAlign: 'left' }}
        >
          <SlidersHorizontal size={22} />
          <span style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <strong style={{ fontSize: '0.98rem' }}>Erweiterte Routenplanung <span style={{ color: 'var(--accent-gold)' }}>(Premium)</span></strong>
            <small style={{ opacity: 0.72, fontWeight: 400 }}>Zwischenziel, Untergrund und persönliche Wünsche</small>
          </span>
        </button>

        <button className="btn-cyberpunk btn-icon-ghost" onClick={onStartSimpleRoute} style={{ marginTop: '8px', minHeight: '44px', justifyContent: 'center', gap: '8px' }}>
          <Route size={17} /> Karte öffnen
        </button>
      </nav>
    </main>
  );
};
