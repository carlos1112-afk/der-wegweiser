import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Sparkles, LogOut, CheckCircle2, User as UserIcon, AlertCircle } from 'lucide-react';
import { AuthService } from '../../services/authService';
import { SoundFxService } from '../../services/soundFxService';
import type { User } from 'firebase/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(AuthService.getCurrentUser());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChange((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    SoundFxService.playClick();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await AuthService.signInWithGoogle();
      setTimeout(() => onClose(), 600);
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Google-Anmeldung fehlgeschlagen. Bitte prüfe deine Internetverbindung.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    SoundFxService.playClick();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await AuthService.signInWithApple();
      setTimeout(() => onClose(), 600);
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Apple-Anmeldung fehlgeschlagen.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleMicrosoftSignIn = async () => {
    SoundFxService.playClick();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await AuthService.signInWithMicrosoft();
      setTimeout(() => onClose(), 600);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Microsoft-Anmeldung fehlgeschlagen.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFacebookSignIn = async () => {
    SoundFxService.playClick();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await AuthService.signInWithFacebook();
      setTimeout(() => onClose(), 600);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Facebook-Anmeldung fehlgeschlagen.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleXSignIn = async () => {
    SoundFxService.playClick();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await AuthService.signInWithX();
      setTimeout(() => onClose(), 600);
    } catch (err: any) {
      setErrorMessage(err?.message || 'X (Twitter)-Anmeldung fehlgeschlagen.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTelegramSignIn = async () => {
    SoundFxService.playClick();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await AuthService.signInWithTelegram();
      setTimeout(() => onClose(), 600);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Telegram-Anmeldung fehlgeschlagen.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    SoundFxService.playClick();
    setIsLoading(true);
    try {
      await AuthService.signOut();
    } catch (err: any) {
      setErrorMessage('Abmeldung fehlgeschlagen.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.85)',
        backdropFilter: 'blur(16px)',
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '500px',
          padding: '28px',
          borderRadius: '24px',
          border: '1px solid var(--accent-cyan)',
          boxShadow: '0 0 40px rgba(0, 240, 255, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: 'rgba(0, 240, 255, 0.1)',
                border: '1px solid var(--accent-cyan)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={24} className="glow-text-cyan" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ffffff', margin: 0 }}>
                {currentUser ? 'Dein Wegweiser Account' : 'OAuth-Anmeldung'}
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                {currentUser ? 'Gemini KI-Funktionen aktiviert' : 'Keine API-Keys nötig — Reines OAuth'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div
            style={{
              backgroundColor: 'rgba(255, 68, 68, 0.15)',
              border: '1px solid #ff4444',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#ff8888',
              fontSize: '0.8rem',
            }}
          >
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* User Status Card */}
        {currentUser ? (
          <div
            style={{
              backgroundColor: 'rgba(0, 240, 255, 0.05)',
              border: '1px solid rgba(0, 240, 255, 0.2)',
              borderRadius: '16px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User'}
                  style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid var(--accent-cyan)' }}
                />
              ) : (
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-cyan)',
                    color: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '1.2rem',
                  }}
                >
                  <UserIcon size={24} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 'bold', color: '#ffffff', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentUser.displayName || 'Angemeldeter Biker'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentUser.email || 'OAuth verifiziert'}
                </div>
              </div>
              <div
                style={{
                  backgroundColor: 'rgba(0, 255, 102, 0.15)',
                  color: '#00ff66',
                  border: '1px solid #00ff66',
                  borderRadius: '20px',
                  padding: '4px 10px',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <CheckCircle2 size={12} /> Aktiv
              </div>
            </div>

            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-primary)',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                padding: '10px 12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Sparkles size={16} className="glow-text-cyan" />
              <span>Google Gemini 2.0 Flash Co-Pilot & Touren-Cloud-Sync sind bereit.</span>
            </div>

            <button
              className="btn-cyberpunk"
              onClick={handleSignOut}
              disabled={isLoading}
              style={{
                borderColor: '#ff4444',
                color: '#ff8888',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '4px',
              }}
            >
              <LogOut size={16} />
              {isLoading ? 'Abmelden...' : 'Abmelden'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.5', margin: 0 }}>
              Melde dich mit einem Klick an, um individuelle Touren zu speichern, Community-Tokens zu sammeln und die <strong>Google Gemini 2.0 KI-Routenplanung</strong> ohne manuelle API-Keys zu nutzen.
            </p>

            {/* Google OAuth Button */}
            <button
              className="btn-cyberpunk btn-gold"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              style={{
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                fontSize: '0.95rem',
                fontWeight: 'bold',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.6 7.2C.6 9.2 0 10.5 0 12.4s.6 3.2 1.6 5.2l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23.8c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 16.7C3.5 20.5 7.4 23.8 12 23.8z"
                />
              </svg>
              {isLoading ? 'Verbinde mit Google...' : 'Mit Google anmelden (Standard)'}
            </button>

            {/* Consumer OAuth Providers Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                className="btn-cyberpunk"
                onClick={handleAppleSignIn}
                disabled={isLoading}
                style={{
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '0.85rem',
                }}
              >
                <span></span> Apple
              </button>
              <button
                className="btn-cyberpunk"
                onClick={handleMicrosoftSignIn}
                disabled={isLoading}
                style={{
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '0.85rem',
                }}
              >
                <span>❖</span> Microsoft
              </button>
              <button
                className="btn-cyberpunk"
                onClick={handleFacebookSignIn}
                disabled={isLoading}
                style={{
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '0.85rem',
                }}
              >
                <span>f</span> Facebook
              </button>
              <button
                className="btn-cyberpunk"
                onClick={handleXSignIn}
                disabled={isLoading}
                style={{
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '0.85rem',
                }}
              >
                <span>𝕏</span> Twitter / X
              </button>
              <button
                className="btn-cyberpunk"
                onClick={handleTelegramSignIn}
                disabled={isLoading}
                style={{
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '0.85rem',
                  gridColumn: 'span 2',
                }}
              >
                <span>✈</span> Telegram
              </button>
            </div>

            {/* Guest mode notice */}
            <div
              style={{
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                paddingTop: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Offline-Karten & StVO-Navigation funktionieren auch als Gast.
              </span>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Als Gast fortfahren
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
