import React, { useState } from 'react';
import { Volume2, VolumeX, Play, Sliders, Check, Bell, X } from 'lucide-react';
import {
  VoiceGuidanceService,
  VOICE_PERSONAS,
  type VoicePersonaId,
  type VoiceSettings,
} from '../../services/voiceGuidanceService';
import { SoundFxService } from '../../services/soundFxService';

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<VoiceSettings>(VoiceGuidanceService.getSettings());

  if (!isOpen) return null;

  const handleSelectPersona = (id: VoicePersonaId) => {
    SoundFxService.playClick();
    const persona = VOICE_PERSONAS[id];
    const updated = VoiceGuidanceService.saveSettings({
      persona: id,
      pitch: persona.defaultPitch,
      rate: persona.defaultRate,
    });
    setSettings(updated);
  };

  const handlePreviewPersona = (id: VoicePersonaId, e: React.MouseEvent) => {
    e.stopPropagation();
    VoiceGuidanceService.speakPreview(id);
  };

  const handleSliderChange = (key: keyof VoiceSettings, value: number) => {
    const updated = VoiceGuidanceService.saveSettings({ [key]: value });
    setSettings(updated);
  };

  const handleToggle = (key: keyof VoiceSettings) => {
    SoundFxService.playClick();
    const updated = VoiceGuidanceService.saveSettings({ [key]: !settings[key] });
    setSettings(updated);
  };

  const handleToggleMute = () => {
    SoundFxService.playClick();
    VoiceGuidanceService.toggleMute();
    setSettings(VoiceGuidanceService.getSettings());
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.85)',
        backdropFilter: 'blur(16px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          borderRadius: '24px',
          border: '1px solid var(--accent-cyan)',
          boxShadow: '0 0 40px rgba(0, 240, 255, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Volume2 size={24} className="glow-text-cyan" />
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ffffff', letterSpacing: '0.5px' }}>
                KI-Stimm-Personas & Audio
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Wähle deinen Sprach-Charakter für Navigation & Co-Pilot
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className={`btn-cyberpunk ${settings.isMuted ? 'btn-gold' : ''}`}
              onClick={handleToggleMute}
              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              title={settings.isMuted ? 'Stummschaltung aufheben' : 'Sprachausgabe stummschalten'}
            >
              {settings.isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              <span>{settings.isMuted ? 'Stumm' : 'Aktiv'}</span>
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Persona Selection Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
          {(Object.values(VOICE_PERSONAS)).map((p) => {
            const isSelected = settings.persona === p.id;
            return (
              <div
                key={p.id}
                onClick={() => handleSelectPersona(p.id)}
                className="glass-panel"
                style={{
                  padding: '14px',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                  boxShadow: isSelected ? 'var(--glow-cyan)' : 'none',
                  backgroundColor: isSelected ? 'rgba(0, 240, 255, 0.08)' : 'rgba(20, 30, 48, 0.4)',
                  transition: 'all 0.25s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '0.95rem', color: isSelected ? 'var(--accent-cyan)' : '#fff' }}>
                        {p.name}
                      </span>
                      {isSelected && <Check size={16} color="var(--accent-cyan)" />}
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--accent-gold)', fontWeight: 'bold' }}>
                      {p.tag}
                    </span>
                  </div>

                  <button
                    onClick={(e) => handlePreviewPersona(p.id, e)}
                    className="btn-cyberpunk"
                    style={{ padding: '4px 10px', fontSize: '0.7rem' }}
                    title="Persona Probe hören"
                  >
                    <Play size={12} fill="currentColor" /> Probe
                  </button>
                </div>

                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                  {p.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Fine Tuning Sliders */}
        <div
          className="glass-panel"
          style={{
            padding: '16px',
            borderRadius: '16px',
            backgroundColor: 'rgba(12, 18, 30, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
            <Sliders size={16} />
            <span>Feinabstimmung & Modulation</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
            {/* Speed Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Geschwindigkeit:</span>
                <span style={{ fontWeight: 'bold', color: '#fff' }}>{settings.rate.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.5"
                step="0.05"
                value={settings.rate}
                onChange={(e) => handleSliderChange('rate', parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
              />
            </div>

            {/* Pitch Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Tonhöhe (Pitch):</span>
                <span style={{ fontWeight: 'bold', color: '#fff' }}>{settings.pitch.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.6"
                max="1.6"
                step="0.05"
                value={settings.pitch}
                onChange={(e) => handleSliderChange('pitch', parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
              />
            </div>

            {/* Volume Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Lautstärke:</span>
                <span style={{ fontWeight: 'bold', color: '#fff' }}>{Math.round(settings.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={settings.volume}
                onChange={(e) => handleSliderChange('volume', parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>

        {/* Trigger Preferences */}
        <div
          className="glass-panel"
          style={{
            padding: '16px',
            borderRadius: '16px',
            backgroundColor: 'rgba(12, 18, 30, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
            <Bell size={16} />
            <span>Automatische Sprach-Ansagen</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.playChimes}
                onChange={() => handleToggle('playChimes')}
                style={{ accentColor: 'var(--accent-cyan)' }}
              />
              <span>Akustischer Vorab-Gong (Chime)</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.announceTurns}
                onChange={() => handleToggle('announceTurns')}
                style={{ accentColor: 'var(--accent-cyan)' }}
              />
              <span>Turn-by-Turn Abbiegehinweise</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.announceBattery}
                onChange={() => handleToggle('announceBattery')}
                style={{ accentColor: 'var(--accent-cyan)' }}
              />
              <span>Akku- & Reichweitenwarnungen</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.announceWeather}
                onChange={() => handleToggle('announceWeather')}
                style={{ accentColor: 'var(--accent-cyan)' }}
              />
              <span>Gegenwind- & Unwetterwarnungen</span>
            </label>
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn-cyberpunk" onClick={onClose} style={{ padding: '10px 24px' }}>
            Fertig & Speichern
          </button>
        </div>
      </div>
    </div>
  );
};
