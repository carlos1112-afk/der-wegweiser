import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Gamepad2, Dices, HelpCircle, Timer, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface LoungeModalProps {
  tokenBalance: number;
  onAddTokens: (amount: number) => void;
  onClose: () => void;
}

interface TriviaQuestion {
  id: number;
  question: string;
  options: { label: string; text: string; isCorrect: boolean }[];
  explanation: string;
}

const quizQuestions: TriviaQuestion[] = [
  {
    id: 1,
    question: "Wie schont man den E-Bike-Akku am Berg am besten?",
    options: [
      { label: "A", text: "Hohe Trittfrequenz (70-80 RPM) & mittlere Motorstufe", isCorrect: true },
      { label: "B", text: "Niedrige Trittfrequenz im höchsten Gang im Turbo-Modus", isCorrect: false },
      { label: "C", text: "Gleichmäßiges Bremsen bei gleichzeitigem Vollgas-Treten", isCorrect: false },
    ],
    explanation: "Eine höhere Trittfrequenz entlastet den Motor und schont die Akkuzellen vor Überhitzung und schnellem Entladen.",
  },
  {
    id: 2,
    question: "Bei welcher Temperatur fühlt sich ein Lithium-Ionen-Akku am wohlsten?",
    options: [
      { label: "A", text: "Bei frostigen Temperaturen unter 0°C", isCorrect: false },
      { label: "B", text: "Bei Zimmertemperatur (15°C bis 25°C)", isCorrect: true },
      { label: "C", text: "Unter praller Sonne bei über 40°C", isCorrect: false },
    ],
    explanation: "Extreme Kälte verringert die Kapazität temporär, extreme Hitze schädigt die Akkuzellen dauerhaft. 15-25°C sind optimal.",
  },
  {
    id: 3,
    question: "Wie lagert man einen E-Bike-Akku optimal über den Winter?",
    options: [
      { label: "A", text: "Komplett leergefahren (0%) im kalten Keller", isCorrect: false },
      { label: "B", text: "Vollständig geladen (100%) in der warmen Wohnung", isCorrect: false },
      { label: "C", text: "Bei ca. 30% bis 60% Ladestand an einem kühlen, trockenen Ort", isCorrect: true },
    ],
    explanation: "Ein mittlerer Ladestand verhindert Tiefentladung und schont die Chemie, da die Zellspannung nicht auf Extremwerten liegt.",
  },
  {
    id: 4,
    question: "Welchen Vorteil bietet eine vorausschauende Routenplanung für E-Bikes?",
    options: [
      { label: "A", text: "Sie spart bis zu 30% Akku durch Vermeidung steiler Steigungen", isCorrect: true },
      { label: "B", text: "Sie erhöht die Maximalgeschwindigkeit des Motors auf 45 km/h", isCorrect: false },
      { label: "C", text: "Sie lädt den Akku durch Solarenergie während der Fahrt auf", isCorrect: false },
    ],
    explanation: "Durch smarte Routenplanung mit geringeren Steigungen kann die Unterstützungsstufe gesenkt und viel Energie gespart werden.",
  },
  {
    id: 5,
    question: "Was erhöht die Reichweite deines E-Bikes am effektivsten?",
    options: [
      { label: "A", text: "Fahren mit minimalem Reifendruck", isCorrect: false },
      { label: "B", text: "Optimaler Reifendruck und regelmäßiges Ölen der Kette", isCorrect: true },
      { label: "C", text: "Tragen von besonders schwerem Gepäck", isCorrect: false },
    ],
    explanation: "Ein optimaler Reifendruck verringert den Rollwiderstand drastisch, sodass weniger Motorunterstützung nötig ist.",
  },
];

const COOLDOWN_KEY = 'lounge_wheel_cooldown';
const QUIZ_ATTEMPT_KEY = 'lounge_quiz_attempted';

export const LoungeModal: React.FC<LoungeModalProps> = ({ tokenBalance, onAddTokens, onClose }) => {
  const [activeTab, setActiveTab] = useState<'wheel' | 'quiz'>('wheel');
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotationDegree, setRotationDegree] = useState(0);
  const [lastWin, setLastWin] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // Quiz State
  const [quizAnswered, setQuizAnswered] = useState<boolean>(() => {
    return sessionStorage.getItem(QUIZ_ATTEMPT_KEY) === 'true';
  });
  const [quizAlreadyCompletedOnLoad] = useState<boolean>(() => {
    return sessionStorage.getItem(QUIZ_ATTEMPT_KEY) === 'true';
  });
  const [currentQuestion] = useState<TriviaQuestion>(() => {
    const randomIndex = Math.floor(Math.random() * quizQuestions.length);
    return quizQuestions[randomIndex];
  });
  const [quizSelectedOption, setQuizSelectedOption] = useState<string | null>(null);
  const [quizIsCorrect, setQuizIsCorrect] = useState<boolean | null>(null);

  const tickTimeoutRef = useRef<ReturnType<typeof setTimeout> | number | null>(null);

  // Wheel Sectors
  const sectors = [
    { label: '+20 Tok.', amount: 20, color: '#111c30', strokeColor: '#ffb700', textColor: '#ffb700', fullLabel: '🪙 +20 Tokens gewonnen! Super Leistung! 🎉' },
    { label: 'Niete', amount: 0, color: '#090d16', strokeColor: '#1e293b', textColor: '#64748b', fullLabel: 'Leider eine Niete erwischt! Beim nächsten Mal klappt es bestimmt. 😉' },
    { label: '+10 Tok.', amount: 10, color: '#0c2533', strokeColor: '#00f0ff', textColor: '#00f0ff', fullLabel: '🪙 +10 Tokens gewonnen! Dranbleiben! 🚀' },
    { label: 'Niete', amount: 0, color: '#090d16', strokeColor: '#1e293b', textColor: '#64748b', fullLabel: 'Leider eine Niete erwischt! Beim nächsten Mal klappt es bestimmt. 😉' },
    { label: '+5 Tok.', amount: 5, color: '#1a102f', strokeColor: '#b026ff', textColor: '#b026ff', fullLabel: '🪙 +5 Tokens gewonnen! Kleinvieh macht auch Mist! 🔋' },
    { label: 'Niete', amount: 0, color: '#090d16', strokeColor: '#1e293b', textColor: '#64748b', fullLabel: 'Leider eine Niete erwischt! Beim nächsten Mal klappt es bestimmt. 😉' },
    { label: '+15 Tok.', amount: 15, color: '#0c2533', strokeColor: '#00f0ff', textColor: '#00f0ff', fullLabel: '🪙 +15 Tokens gewonnen! Großartig! 🌟' },
    { label: 'Niete', amount: 0, color: '#090d16', strokeColor: '#1e293b', textColor: '#64748b', fullLabel: 'Leider eine Niete erwischt! Beim nächsten Mal klappt es bestimmt. 😉' },
  ];

  // Synthesize custom sound effects with Web Audio API
  const playSynthesizedSound = (type: 'tick' | 'victory' | 'failure') => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      if (type === 'tick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(550, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      } else if (type === 'victory') {
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);

          gain.gain.setValueAtTime(0, now + idx * 0.1);
          gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.1 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.4);
        });
      } else if (type === 'failure') {
        const now = ctx.currentTime;
        const notes = [220, 180]; // Descending sad buzz
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + idx * 0.15);

          gain.gain.setValueAtTime(0, now + idx * 0.15);
          gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.15 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.25);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.15);
          osc.stop(now + idx * 0.15 + 0.3);
        });
      }
    } catch (e) {
      console.warn('Audio Context error ignored:', e);
    }
  };

  const playDeceleratingTicks = (delay: number) => {
    if (delay > 600) return;
    playSynthesizedSound('tick');
    tickTimeoutRef.current = setTimeout(() => {
      playDeceleratingTicks(delay * 1.15);
    }, delay);
  };

  // Cooldown checking
  useEffect(() => {
    const checkCooldown = () => {
      const stored = localStorage.getItem(COOLDOWN_KEY);
      if (stored) {
        const remaining = Math.max(0, parseInt(stored, 10) - Date.now());
        setCooldownRemaining(Math.ceil(remaining / 1000));
      }
    };

    checkCooldown();
    const interval = setInterval(() => {
      const stored = localStorage.getItem(COOLDOWN_KEY);
      if (stored) {
        const remaining = Math.max(0, parseInt(stored, 10) - Date.now());
        setCooldownRemaining(Math.ceil(remaining / 1000));
        if (remaining <= 0) {
          clearInterval(interval);
        }
      } else {
        clearInterval(interval);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      if (tickTimeoutRef.current) {
        clearTimeout(tickTimeoutRef.current as any);
      }
    };
  }, [isSpinning]);

  // Spin the Lucky Wheel ("Life's a gamble! ;D")
  const handleSpinWheel = () => {
    if (isSpinning || cooldownRemaining > 0) return;
    setIsSpinning(true);
    setLastWin(null);

    // Play tactile ticking sounds slowing down
    playDeceleratingTicks(50);

    const winningIndex = Math.floor(Math.random() * sectors.length);
    const winningSector = sectors[winningIndex];

    const currentSpins = Math.ceil(rotationDegree / 360);
    const targetAngle = (270 - (winningIndex * 45 + 22.5)) % 360;
    const normalizedTargetAngle = targetAngle < 0 ? targetAngle + 360 : targetAngle;
    const newRotation = (currentSpins + 5) * 360 + normalizedTargetAngle;
    setRotationDegree(newRotation);

    setTimeout(() => {
      setIsSpinning(false);
      setLastWin(winningSector.fullLabel);

      if (winningSector.amount > 0) {
        onAddTokens(winningSector.amount);
        playSynthesizedSound('victory');
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
      } else {
        playSynthesizedSound('failure');
      }

      // Save 30-second cooldown in LocalStorage
      const cooldownTime = Date.now() + 30000;
      localStorage.setItem(COOLDOWN_KEY, cooldownTime.toString());
      setCooldownRemaining(30);
    }, 4000);
  };

  const handleQuizAnswer = (optionLabel: string, isCorrect: boolean) => {
    if (quizAnswered) return;

    setQuizSelectedOption(optionLabel);
    setQuizIsCorrect(isCorrect);
    setQuizAnswered(true);
    sessionStorage.setItem(QUIZ_ATTEMPT_KEY, 'true');

    if (isCorrect) {
      onAddTokens(15);
      playSynthesizedSound('victory');
      confetti({ particleCount: 50, spread: 50 });
    } else {
      playSynthesizedSound('failure');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 8, 15, 0.85)',
        backdropFilter: 'blur(12px)',
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
          maxWidth: '520px',
          width: '100%',
          padding: '28px',
          border: '1px solid var(--accent-gold)',
          boxShadow: 'var(--glow-gold)',
          borderRadius: '16px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="glow-text-gold">
            <Gamepad2 size={24} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
              CHARGE 'N' EARN LADE-LOUNGE
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8a99ad', cursor: 'pointer', fontSize: '1.2rem', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#fff'} onMouseLeave={(e) => e.currentTarget.style.color = '#8a99ad'}>
            ✕
          </button>
        </div>

        {/* Current Balance */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            backgroundColor: 'rgba(255, 183, 0, 0.1)',
            borderRadius: '12px',
            border: '1px solid var(--accent-gold)',
            marginBottom: '20px',
          }}
        >
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Dein Token-Guthaben:</span>
          <span className="glow-text-gold" style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>
            🪙 {tokenBalance} Tokens
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button
            onClick={() => setActiveTab('wheel')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid var(--border-glass)',
              backgroundColor: activeTab === 'wheel' ? 'rgba(255, 183, 0, 0.25)' : 'transparent',
              color: activeTab === 'wheel' ? 'var(--accent-gold)' : 'var(--text-muted)',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            <Dices size={16} /> Glücksrad ("Life's a gamble! ;D")
          </button>

          <button
            onClick={() => setActiveTab('quiz')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid var(--border-glass)',
              backgroundColor: activeTab === 'quiz' ? 'rgba(0, 240, 255, 0.25)' : 'transparent',
              color: activeTab === 'quiz' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            <HelpCircle size={16} /> E-Bike Quiz
          </button>
        </div>

        {/* Lucky Wheel Tab */}
        {activeTab === 'wheel' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            {/* Beautiful rotating circle layout */}
            <div style={{ position: 'relative', width: '220px', height: '220px', margin: '20px auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {/* Outer glowing ring */}
              <div style={{
                position: 'absolute',
                width: '216px',
                height: '216px',
                borderRadius: '50%',
                border: '4px solid var(--accent-gold, #ffb700)',
                boxShadow: '0 0 20px rgba(255, 183, 0, 0.4), inset 0 0 20px rgba(255, 183, 0, 0.2)',
                pointerEvents: 'none',
              }} />

              {/* Pointer Indicator */}
              <div style={{
                position: 'absolute',
                top: '-6px',
                zIndex: 10,
                width: 0,
                height: 0,
                borderLeft: '14px solid transparent',
                borderRight: '14px solid transparent',
                borderTop: '22px solid var(--accent-gold, #ffb700)',
                filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.6))',
              }} />

              {/* Rotating SVG Wheel */}
              <div style={{
                width: '200px',
                height: '200px',
                borderRadius: '50%',
                transition: isSpinning ? 'transform 4s cubic-bezier(0.15, 0.85, 0.25, 1)' : 'transform 0.5s ease',
                transform: `rotate(${rotationDegree}deg)`,
              }}>
                <svg width="200" height="200" viewBox="0 0 200 200" style={{ display: 'block' }}>
                  {sectors.map((sector, idx) => {
                    const midAngle = idx * 45 + 22.5;
                    return (
                      <g key={idx} transform={`rotate(${midAngle}, 100, 100)`}>
                        <path
                          d="M 100 100 L 192.39 61.73 A 100 100 0 0 1 192.39 138.27 Z"
                          fill={sector.color}
                          stroke={sector.strokeColor}
                          strokeWidth="2"
                        />
                        <text
                          x="150"
                          y="100"
                          fill={sector.textColor}
                          fontSize="9"
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={midAngle > 90 && midAngle < 270 ? 'rotate(180, 150, 100)' : undefined}
                        >
                          {sector.label}
                        </text>
                      </g>
                    );
                  })}
                  {/* Center Pin */}
                  <circle cx="100" cy="100" r="14" fill="#05080f" stroke="var(--accent-gold, #ffb700)" strokeWidth="3" />
                  <circle cx="100" cy="100" r="6" fill="var(--accent-gold, #ffb700)" />
                </svg>
              </div>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Vertreib dir die Akku-Ladezeit! Drehe am Glücksrad und gewinne kostenlose Tokens für KI-Routen.
            </p>

            {cooldownRemaining > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--accent-gold)', fontSize: '0.85rem', marginBottom: '12px', fontWeight: 'bold' }}>
                <Timer size={16} /> Ladespaß-Sperre aktiv: Noch {cooldownRemaining}s abkühlen...
              </div>
            )}

            <button
              onClick={handleSpinWheel}
              disabled={isSpinning || cooldownRemaining > 0}
              className="btn-gold"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: (isSpinning || cooldownRemaining > 0) ? 'not-allowed' : 'pointer',
                opacity: (isSpinning || cooldownRemaining > 0) ? 0.6 : 1,
              }}
            >
              {isSpinning ? 'Glücksrad dreht sich...' : cooldownRemaining > 0 ? `Abkühlen (${cooldownRemaining}s)` : '🎡 Jetzt Drehen (Bis zu +20 Tokens)'}
            </button>
          </div>
        )}

        {/* Quiz Tab */}
        {activeTab === 'quiz' && (
          <div style={{ padding: '12px 0' }}>
            {quizAlreadyCompletedOnLoad ? (
              <div style={{ padding: '24px 16px', backgroundColor: 'rgba(0, 240, 255, 0.05)', borderRadius: '12px', border: '1px dashed rgba(0, 240, 255, 0.3)', textAlign: 'center' }}>
                <p style={{ fontWeight: 'bold', color: 'var(--accent-cyan)', marginBottom: '8px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  🔒 Quiz bereits absolviert
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                  Du hast dein Quiz-Guthaben für diese Session bereits eingelöst! Lade dein E-Bike weiter auf und komm bei der nächsten Fahrt wieder vorbei.
                </p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <HelpCircle size={20} className="glow-text-cyan" />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      E-Bike Trivia (Frage #{currentQuestion.id})
                    </span>
                  </div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '16px', lineHeight: '1.4' }} className="glow-text-cyan">
                    {currentQuestion.question}
                  </h4>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {currentQuestion.options.map((opt) => {
                    const isSelected = quizSelectedOption === opt.label;
                    const showCorrect = quizAnswered && opt.isCorrect;
                    const showWrong = quizAnswered && isSelected && !opt.isCorrect;

                    let buttonBg = 'rgba(10, 15, 25, 0.8)';
                    let buttonBorder = '1px solid var(--border-glass)';
                    let buttonColor = '#fff';
                    let cursorStyle = 'pointer';

                    if (quizAnswered) {
                      cursorStyle = 'default';
                      if (showCorrect) {
                        buttonBg = 'rgba(0, 255, 102, 0.1)';
                        buttonBorder = '1px solid var(--accent-neon-green, #00ff66)';
                        buttonColor = '#00ff66';
                      } else if (showWrong) {
                        buttonBg = 'rgba(255, 50, 50, 0.1)';
                        buttonBorder = '1px solid #ff3232';
                        buttonColor = '#ff3232';
                      } else {
                        buttonBg = 'rgba(10, 15, 25, 0.4)';
                        buttonBorder = '1px solid rgba(255, 255, 255, 0.05)';
                        buttonColor = 'rgba(255, 255, 255, 0.4)';
                      }
                    }

                    return (
                      <button
                        key={opt.label}
                        disabled={quizAnswered}
                        onClick={() => handleQuizAnswer(opt.label, opt.isCorrect)}
                        style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          backgroundColor: buttonBg,
                          border: buttonBorder,
                          borderRadius: '8px',
                          color: buttonColor,
                          cursor: cursorStyle,
                          transition: 'all 0.2s ease',
                          fontSize: '0.9rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          width: '100%',
                        }}
                      >
                        <span>
                          <strong>{opt.label})</strong> {opt.text}
                        </span>
                        {quizAnswered && opt.isCorrect && <CheckCircle2 size={16} style={{ color: '#00ff66', flexShrink: 0 }} />}
                        {quizAnswered && isSelected && !opt.isCorrect && <XCircle size={16} style={{ color: '#ff3232', flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>

                {quizAnswered && (
                  <div
                    style={{
                      marginTop: '20px',
                      padding: '14px',
                      backgroundColor: quizIsCorrect ? 'rgba(0, 255, 102, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                      border: quizIsCorrect ? '1px solid rgba(0, 255, 102, 0.3)' : '1px solid var(--border-glass)',
                      borderRadius: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <AlertCircle size={16} style={{ color: quizIsCorrect ? '#00ff66' : 'var(--accent-cyan)' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: quizIsCorrect ? '#00ff66' : 'var(--accent-cyan)' }}>
                        {quizIsCorrect ? 'Hervorragend! Richtig geantwortet.' : 'Nicht ganz richtig. Hier ist des Rätsels Lösung:'}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.4' }}>
                      {currentQuestion.explanation}
                    </p>
                    {quizIsCorrect && (
                      <div style={{ marginTop: '8px', fontSize: '0.9rem', fontWeight: 'bold', color: '#00ff66' }}>
                        🪙 +15 Tokens wurden gutgeschrieben!
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Win Message Banner */}
        {lastWin && activeTab === 'wheel' && (
          <div
            style={{
              marginTop: '20px',
              padding: '12px',
              backgroundColor: lastWin.includes('Niete') ? 'rgba(255, 50, 50, 0.1)' : 'rgba(0, 255, 102, 0.12)',
              border: lastWin.includes('Niete') ? '1px solid #ff3232' : '1px solid var(--accent-neon-green)',
              borderRadius: '8px',
              textAlign: 'center',
              fontWeight: 'bold',
              color: lastWin.includes('Niete') ? '#ff3232' : 'var(--accent-neon-green)',
              fontSize: '0.9rem',
            }}
          >
            {lastWin}
          </div>
        )}
      </div>
    </div>
  );
};
