import React, { useState } from 'react';
import { Star, MessageSquare, CheckCircle2, Sparkles, X } from 'lucide-react';
import type { ChargingStation } from '../../types/navigation';
import { SoundFxService } from '../../services/soundFxService';
import confetti from 'canvas-confetti';

interface StationReviewModalProps {
  isOpen: boolean;
  station: ChargingStation | null;
  onAddReview: (review: { rating: number; comment: string; tags: string[] }) => void;
  onClose: () => void;
}

export const StationReviewModal: React.FC<StationReviewModalProps> = ({
  isOpen,
  station,
  onAddReview,
  onClose,
}) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Überdacht / Wetterfest', 'Steckdose aktiv']);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen || !station) return null;

  const availableTags = [
    'Überdacht / Wetterfest',
    'Steckdose aktiv',
    'Schnellladung',
    'Fahrradständer vorhanden',
    'Café geöffnet',
    'Luftpumpe / Werkzeug',
  ];

  const handleToggleTag = (tag: string) => {
    SoundFxService.playClick();
    if (selectedTags.includes(tag)) {
      setSelectedTags((prev) => prev.filter((t) => t !== tag));
    } else {
      setSelectedTags((prev) => [...prev, tag]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    SoundFxService.playSuccessChime();
    confetti({ particleCount: 70, spread: 70 });
    onAddReview({ rating, comment, tags: selectedTags });
    setIsSubmitted(true);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.88)',
        backdropFilter: 'blur(16px)',
        zIndex: 2200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '24px',
          borderRadius: '20px',
          border: '1px solid var(--accent-gold)',
          boxShadow: 'var(--glow-gold)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="glow-text-gold">
            <MessageSquare size={26} />
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>LADEPUNKT BEWERTEN</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {station.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#8a99ad', cursor: 'pointer', fontSize: '1.3rem' }}
          >
            <X size={22} />
          </button>
        </div>

        {isSubmitted ? (
          <div style={{ textAlign: 'center', padding: '24px 12px' }}>
            <CheckCircle2 size={54} color="#00ff66" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
              Vielen Dank für deine Bewertung!
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '18px' }}>
              Du hast der E-Bike Community geholfen und <strong>+10 Tokens</strong> verdient.
            </p>
            <button className="btn-cyberpunk btn-gold" onClick={onClose} style={{ padding: '10px 24px' }}>
              Fertig
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Stars Selector */}
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Wie zuverlässig war dieser Lade-Stopp?
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => {
                      SoundFxService.playClick();
                      setRating(star);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                  >
                    <Star
                      size={32}
                      color={star <= rating ? '#ffb700' : '#475569'}
                      fill={star <= rating ? '#ffb700' : 'none'}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Feature Tags */}
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Ausstattung & Zustand antippen:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {availableTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleTag(tag)}
                      className={`btn-cyberpunk ${isSelected ? 'btn-gold' : ''}`}
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.7rem',
                        borderRadius: '8px',
                        borderColor: isSelected ? 'var(--accent-gold)' : 'var(--border-glass)',
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comment Textarea */}
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Kommentar / Hinweise für andere Fahrer:
              </label>
              <textarea
                rows={3}
                placeholder="z. B. Steckdose befindet sich links an der Hauswand hinter den Rosenbüschen..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: 'rgba(10, 15, 25, 0.8)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  resize: 'none',
                }}
              />
            </div>

            <button type="submit" className="btn-cyberpunk btn-gold" style={{ padding: '12px', justifyContent: 'center', marginTop: '6px' }}>
              <Sparkles size={16} /> Bewertung Absenden (+10 Tokens)
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
