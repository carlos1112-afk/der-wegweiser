import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Gamepad2,
  Dices,
  HelpCircle,
  Timer,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Zap,
  ShoppingBag,
  Trophy,
  Award,
  Flame,
  Sparkles,
  QrCode,
  FileText,
  Play,
  CreditCard,
  Building2,
  ExternalLink,
  MapPin,
  Compass,
  Map as MapIcon,
  Check,
  X,
} from 'lucide-react';
import { SoundFxService } from '../../services/soundFxService';
import { functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import { ConsentService } from '../../services/consentService';
import { PartnerModal } from './PartnerModal';

interface LoungeModalProps {
  tokenBalance: number;
  onTokenBalanceRefresh: (serverBalance?: number) => Promise<void>;
  onClose: () => void;
}

export interface MapQuest {
  id: string;
  title: string;
  category: 'surface' | 'charging' | 'slope' | 'obstacle' | 'community_verify';
  locationName: string;
  lat: number;
  lng: number;
  bountyTokens: number;
  description: string;
  lastUpdatedDate: string;
  verificationType: 'live_gps' | 'ride_history' | 'community_report';
  verificationBadgeText: string;
  communityReportInfo?: {
    reportedBy: string;
    reportedDate: string;
    details: string;
  };
  questions: {
    question: string;
    options: string[];
  }[];
}

const MAP_QUESTS: MapQuest[] = [
  {
    id: 'quest-scout-corridor',
    title: '🗺️ Scout-Korridor: Steigung & Watt-Kalibrierung',
    category: 'slope',
    locationName: 'Panorama-Höhenkamm Sektor Nord',
    lat: 52.44,
    lng: 13.46,
    bountyTokens: 30,
    lastUpdatedDate: '2024-08-01',
    verificationType: 'live_gps',
    verificationBadgeText: '⭐ Höchste Belohnung: Live-Standort auf aktiver Fahrt im Scout-Modus (< 150m)',
    description: 'Du befindest dich live im Ziel-Sektor. Deine Echtzeit-Daten aktualisieren Steigung & Wattstunden-Bedarf für alle E-Biker.',
    questions: [
      {
        question: 'Wie steil ist die stärkste Rampe auf diesem Abschnitt?',
        options: ['Moderat (4-7 %)', 'Anspruchsvoll (8-12 %)', 'Extrem steil (>14 % Turbo nötig)', '🤷 Weiß nicht / Nicht darauf geachtet'],
      },
      {
        question: 'Gibt es eine Fahrrad-Reparatursäule oder Pumpe vor Ort?',
        options: ['Ja, voll funktionsfähig', 'Ja, aber defekt / Werkzeug fehlt', 'Nein, keine Werkzeuge', '🤷 Weiß nicht / Nicht darauf geachtet'],
      },
    ],
  },
  {
    id: 'quest-slope-live',
    title: '📍 Vor-Ort Check: Marktplatz Lade-Infrastruktur',
    category: 'charging',
    locationName: 'Rathauspassage E-Bike Ladesäule',
    lat: 52.51,
    lng: 13.40,
    bountyTokens: 18,
    lastUpdatedDate: '2024-05-20',
    verificationType: 'live_gps',
    verificationBadgeText: '📍 Live-Standort vor Ort verifiziert (< 200m Distanz)',
    description: 'Prüfe vor Ort, ob die Schuko-Steckdosen noch aktiv, stromführend und frei zugänglich sind.',
    questions: [
      {
        question: 'Funktionieren die Steckdosen aktuell?',
        options: ['Ja, Strom fließt (erfolgreich getestet / LED leuchtet)', 'Steckdose defekt / kein Strom', 'Abgesperrt oder zugeparkt', '🤷 Weiß nicht / Nicht getestet'],
      },
      {
        question: 'Wie ist der Wetterschutz vor Ort?',
        options: ['Vollständig überdacht & regensicher', 'Teilweise überdacht', 'Komplett ungeschützt im Freien', '🤷 Weiß nicht / Nicht darauf geachtet'],
      },
    ],
  },
  {
    id: 'quest-charge-community',
    title: '👥 Community-Gegenprüfung: Neuer Ladepunkt',
    category: 'community_verify',
    locationName: 'Schutzhütte Birkenhain (KM 18.5)',
    lat: 52.52,
    lng: 13.42,
    bountyTokens: 12,
    lastUpdatedDate: 'Vor 2 Tagen gemeldet',
    verificationType: 'community_report',
    verificationBadgeText: '👥 Community-Meldung von Radler_Klaus (Vor 2 Tagen). Du bist kürzlich vorbeigefahren.',
    communityReportInfo: {
      reportedBy: 'Radler_Klaus',
      reportedDate: 'Vor 2 Tagen',
      details: 'Neue wetterfeste 230V Schuko-Steckdose an der hölzernen Schutzhütte montiert.',
    },
    description: 'Bestätige oder korrigiere die Community-Meldung aus deiner Erinnerung.',
    questions: [
      {
        question: 'Ist die gemeldete Steckdose an der Schutzhütte vorhanden?',
        options: ['Ja, Steckdose ist vorhanden & frei zugänglich', 'Nein, keine Steckdose an der Hütte gefunden', '🤷 Weiß nicht / Nicht darauf geachtet'],
      },
      {
        question: 'Fließt Strom / Funktioniert die Dose?',
        options: ['Ja, Strom fließt (getestet / LED leuchtet)', 'Nein, stromlos oder defekt', '🤷 Weiß nicht / Nicht getestet'],
      },
    ],
  },
  {
    id: 'quest-surface-1',
    title: '🕒 Rückwirkende Verifikation: Waldradweg Belag',
    category: 'surface',
    locationName: 'Kiefernforst Radweg KM 4.2',
    lat: 52.48,
    lng: 13.38,
    bountyTokens: 10,
    lastUpdatedDate: '2024-06-12',
    verificationType: 'ride_history',
    verificationBadgeText: '🕒 Aus vergangener Tour: Treffer in deiner GPX-Fahrtenhistorie vor 2 Tagen',
    description: 'Du bist hier vor kurzem vorbeigefahren. Hilf mit, den Wegezustand rückwirkend einzustufen.',
    questions: [
      {
        question: 'Wie war der Straßenbelag auf diesem Teilstück?',
        options: ['Frisch & glatt asphaltiert', 'Fester Feinschotter (gut fahrbar)', 'Grober Schotter & Schlaglöcher', '🤷 Weiß nicht / Nicht darauf geachtet'],
      },
      {
        question: 'Gab es Hindernisse oder Sperrungen?',
        options: ['Freie Fahrt ohne Barrieren', 'Drängelgitter / Engstelle vorhanden', 'Weg blockiert', '🤷 Weiß nicht / Nicht darauf geachtet'],
      },
    ],
  },
];

interface TriviaQuestion {
  challengeId: string;
  questionId: string;
  question: string;
  options: { label: string; text: string }[];
  explanation: string;
  rewardTokens: number;
  completed: boolean;
}

interface ShopItem {
  id: string;
  title: string;
  cost: number;
  category: 'voucher' | 'style' | 'perk';
  icon: string;
  description: string;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  scans: number;
  tokens: number;
  badge: string;
  isUser?: boolean;
}

const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'coffee-pass',
    title: '1x Bio-Kaffee im Bike-Café',
    cost: 40,
    category: 'voucher',
    icon: '☕',
    description: 'Gültig bei über 45 Partner-Cafés und E-Bike Ladestationen entlang der Hauptradwege.',
  },
  {
    id: 'cyber-skin',
    title: 'Hologramm Neon-Kartenstil',
    cost: 75,
    category: 'style',
    icon: '🗺️',
    description: 'Schaltet den ultra-kontrastreichen Cyber-Glow Vektorkartenstil für Nachtfahrten frei.',
  },
  {
    id: 'service-discount',
    title: '15% E-Bike Werkstatt-Rabatt',
    cost: 100,
    category: 'voucher',
    icon: '🔧',
    description: '15% Preisnachlass auf Inspektion, Bremsenservice oder Akku-Check bei Partnerwerkstätten.',
  },
  {
    id: 'super-cloud-pass',
    title: 'VIP Vertex AI Super-Route',
    cost: 25,
    category: 'perk',
    icon: '⚡',
    description: 'Priorisierte KI-Routenberechnung mit Windwiderstands- und Steigungssimulation.',
  },
];

const LEADERBOARD_DATA: LeaderboardEntry[] = [
  { rank: 1, name: 'CyberRider_Alex', scans: 48, tokens: 960, badge: '👑 Grid Master' },
  { rank: 2, name: 'VoltVicki_Berlin', scans: 39, tokens: 780, badge: '⚡ Watt Whisperer' },
  { rank: 3, name: 'E-Trail_Marc', scans: 31, tokens: 620, badge: '🌲 Trail Pioneer' },
  { rank: 4, name: 'Carlos (Du)', scans: 14, tokens: 280, badge: '🚴 E-Bike Scout', isUser: true },
  { rank: 5, name: 'EcoSprint_Lena', scans: 12, tokens: 240, badge: '🔋 Battery Saver' },
  { rank: 6, name: 'Sven_Hamburg', scans: 9, tokens: 180, badge: '⚓ Hafen Cruiser' },
];

export const LoungeModal: React.FC<LoungeModalProps> = ({ tokenBalance, onTokenBalanceRefresh, onClose }) => {
  const [activeTab, setActiveTab] = useState<'wheel' | 'quests' | 'catcher' | 'surveys' | 'quiz' | 'shop' | 'leaderboard'>('wheel');
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotationDegree, setRotationDegree] = useState(0);
  const [lastWin, setLastWin] = useState<string | null>(null);
  const [wheelAlreadySpun, setWheelAlreadySpun] = useState(false);
  const [wheelStatusLoading, setWheelStatusLoading] = useState(true);

  // Map Quests State
  const [selectedQuest, setSelectedQuest] = useState<MapQuest | null>(null);
  const [questAnswers, setQuestAnswers] = useState<Record<number, string>>({});
  const [questPinConfirmed, setQuestPinConfirmed] = useState(false);
  const [questNotice, setQuestNotice] = useState<string | null>(null);

  const handleStartQuest = (quest: MapQuest) => {
    SoundFxService.playClick();
    setSelectedQuest(quest);
    setQuestAnswers({});
    setQuestPinConfirmed(false);
  };

  const handleAnswerQuest = (qIdx: number, ans: string) => {
    SoundFxService.playClick();
    setQuestAnswers((prev) => ({ ...prev, [qIdx]: ans }));
  };

  const handleConfirmQuestPin = () => {
    SoundFxService.playTurnChime();
    setQuestPinConfirmed(true);
  };

  const handleSubmitQuest = () => {
    setQuestNotice('Missionen sind derzeit Demo-Inhalte. Standort und Antworten werden nicht als geprüft gespeichert und es gibt dafür keine Token-Gutschrift.');
  };

  // Survey State

  // B2B Partner Modal State
  const [showPartnerModal, setShowPartnerModal] = useState(false);

  // Watt-Catcher Game State
  const [catcherActive, setCatcherActive] = useState(false);
  const [catcherScore, setCatcherScore] = useState(0);
  const catcherScoreRef = useRef(0);
  const [catcherFinalScore, setCatcherFinalScore] = useState<number | null>(null);
  const [catcherTimeLeft, setCatcherTimeLeft] = useState(20);
  const [catcherOrbs, setCatcherOrbs] = useState<{ id: number; x: number; y: number; type: 'energy' | 'super' | 'glitch' }[]>([]);

  // Shop state
  const [redeemedCodes, setRedeemedCodes] = useState<Record<string, string>>({});

  // Quiz State
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizAlreadyCompletedOnLoad, setQuizAlreadyCompletedOnLoad] = useState(false);
  const [quizLoading, setQuizLoading] = useState(true);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<TriviaQuestion | null>(null);
  const [quizSelectedOption, setQuizSelectedOption] = useState<string | null>(null);
  const [quizIsCorrect, setQuizIsCorrect] = useState<boolean | null>(null);
  const [correctAnswerLabel, setCorrectAnswerLabel] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!functions) {
      setQuizError('Das Tagesquiz ist derzeit nicht verfügbar.');
      setQuizLoading(false);
      return;
    }
    const getChallenge = httpsCallable<Record<string, never>, TriviaQuestion>(functions, 'getTokenQuizChallenge');
    getChallenge({}).then(({ data }) => {
      if (!active) return;
      setCurrentQuestion(data);
      setQuizAlreadyCompletedOnLoad(data.completed);
      setQuizAnswered(data.completed);
    }).catch((error: any) => {
      if (!active) return;
      setQuizError(error?.code === 'functions/unauthenticated'
        ? 'Melde dich an und aktiviere App Check, um am Tokenquiz teilzunehmen.'
        : 'Das Tagesquiz konnte nicht geladen werden. Bitte versuche es später erneut.');
    }).finally(() => {
      if (active) setQuizLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!functions) {
      setWheelStatusLoading(false);
      return;
    }
    let active = true;
    const getStatus = httpsCallable<Record<string, never>, { alreadySpun: boolean }>(functions, 'getTokenWheelStatus');
    getStatus({}).then(({ data }) => {
      if (active) setWheelAlreadySpun(data.alreadySpun === true);
    }).catch(() => {
      // The spin callable remains the final authority if status lookup is unavailable.
    }).finally(() => {
      if (active) setWheelStatusLoading(false);
    });
    return () => { active = false; };
  }, []);

  const tickTimeoutRef = useRef<ReturnType<typeof setTimeout> | number | null>(null);

  // Wheel Sectors (Fair balance: max 10 tokens, lower than active live scouting)
  const sectors = [
    { label: '+8 Tok.', amount: 8, color: '#111c30', strokeColor: '#ffb700', textColor: '#ffb700', fullLabel: '🪙 +8 Tokens gewonnen! Toller Pausengewinn! 🎉' },
    { label: 'Niete', amount: 0, color: '#090d16', strokeColor: '#1e293b', textColor: '#64748b', fullLabel: 'Leider eine Niete erwischt! Beim nächsten Mal klappt es bestimmt. 😉' },
    { label: '+5 Tok.', amount: 5, color: '#0c2533', strokeColor: '#00E6A3', textColor: '#00E6A3', fullLabel: '🪙 +5 Tokens gewonnen! Dranbleiben! 🚀' },
    { label: 'Niete', amount: 0, color: '#090d16', strokeColor: '#1e293b', textColor: '#64748b', fullLabel: 'Leider eine Niete erwischt! Beim nächsten Mal klappt es bestimmt. 😉' },
    { label: '+2 Tok.', amount: 2, color: '#1a102f', strokeColor: '#b026ff', textColor: '#b026ff', fullLabel: '🪙 +2 Tokens gewonnen! Kleinvieh macht auch Mist! 🔋' },
    { label: 'Niete', amount: 0, color: '#090d16', strokeColor: '#1e293b', textColor: '#64748b', fullLabel: 'Leider eine Niete erwischt! Beim nächsten Mal klappt es bestimmt. 😉' },
    { label: '+10 Tok.', amount: 10, color: '#0c2533', strokeColor: '#00E6A3', textColor: '#00E6A3', fullLabel: '🪙 +10 Tokens gewonnen! Großartig! 🌟' },
    { label: 'Niete', amount: 0, color: '#090d16', strokeColor: '#1e293b', textColor: '#64748b', fullLabel: 'Leider eine Niete erwischt! Beim nächsten Mal klappt es bestimmt. 😉' },
  ];

  const playDeceleratingTicks = (delay: number) => {
    if (delay > 600) return;
    SoundFxService.playClick();
    tickTimeoutRef.current = setTimeout(() => {
      playDeceleratingTicks(delay * 1.15);
    }, delay);
  };

  useEffect(() => () => {
    if (tickTimeoutRef.current) clearTimeout(tickTimeoutRef.current as any);
  }, []);

  // Watt-Catcher Game Loop
  useEffect(() => {
    if (!catcherActive) return;

    const timer = setInterval(() => {
      setCatcherTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          endCatcherGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const spawner = setInterval(() => {
      const id = Date.now() + Math.random();
      const x = Math.floor(Math.random() * 80) + 10;
      const y = Math.floor(Math.random() * 70) + 15;
      const rand = Math.random();
      const type: 'energy' | 'super' | 'glitch' = rand > 0.85 ? 'super' : rand < 0.2 ? 'glitch' : 'energy';

      setCatcherOrbs((prev) => [...prev.slice(-6), { id, x, y, type }]);
    }, 800);

    return () => {
      clearInterval(timer);
      clearInterval(spawner);
    };
  }, [catcherActive]);

  const startCatcherGame = () => {
    SoundFxService.playClick();
    setCatcherScore(0);
    catcherScoreRef.current = 0;
    setCatcherFinalScore(null);
    setCatcherTimeLeft(20);
    setCatcherOrbs([]);
    setCatcherActive(true);
  };

  const endCatcherGame = () => {
    setCatcherActive(false);
    setCatcherOrbs([]);
    setCatcherFinalScore(catcherScoreRef.current);
  };

  const handleCatchOrb = (id: number, type: 'energy' | 'super' | 'glitch') => {
    setCatcherOrbs((prev) => prev.filter((o) => o.id !== id));
    if (type === 'energy') {
      catcherScoreRef.current += 2;
      setCatcherScore(catcherScoreRef.current);
      SoundFxService.playClick();
    } else if (type === 'super') {
      catcherScoreRef.current += 5;
      setCatcherScore(catcherScoreRef.current);
      SoundFxService.playTurnChime();
    } else if (type === 'glitch') {
      catcherScoreRef.current = Math.max(0, catcherScoreRef.current - 3);
      setCatcherScore(catcherScoreRef.current);
      SoundFxService.playWarningTone();
    }
  };

  const handleSpinWheel = async () => {
    if (isSpinning || wheelAlreadySpun || !functions) return;
    setIsSpinning(true);
    setLastWin(null);
    try {
      const spin = httpsCallable<Record<string, never>, { segmentIndex: number; rewardTokens: number; balance: number | null }>(functions, 'spinTokenWheel');
      const { data } = await spin({});
      if (!Number.isInteger(data.segmentIndex) || data.segmentIndex < 0 || data.segmentIndex >= sectors.length
        || data.rewardTokens !== sectors[data.segmentIndex].amount) {
        throw new Error('Ungültiges Serverergebnis für das Glücksrad.');
      }

      const winningSector = sectors[data.segmentIndex];
      playDeceleratingTicks(50);
      const currentSpins = Math.ceil(rotationDegree / 360);
      const targetAngle = (270 - (data.segmentIndex * 45 + 22.5)) % 360;
      const normalizedTargetAngle = targetAngle < 0 ? targetAngle + 360 : targetAngle;
      setRotationDegree((currentSpins + 5) * 360 + normalizedTargetAngle);

      setTimeout(() => {
        setIsSpinning(false);
        setWheelAlreadySpun(true);
        setLastWin(winningSector.fullLabel);
        if (data.rewardTokens > 0) {
          void onTokenBalanceRefresh(data.balance ?? undefined).catch((error) => {
            console.warn('[LoungeModal] Serverkonto konnte nach Radgutschrift nicht aktualisiert werden:', error);
          });
          SoundFxService.playSuccessChime();
          confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
        } else {
          SoundFxService.playWarningTone();
        }
      }, 4000);
    } catch (error: any) {
      setIsSpinning(false);
      if (error?.code === 'functions/already-exists') setWheelAlreadySpun(true);
      else alert('Das Glücksrad konnte nicht sicher gestartet werden. Bitte melde dich an und versuche es später erneut.');
    }
  };

  const handleQuizAnswer = async (optionLabel: string) => {
    if (quizAnswered || quizSubmitting || !currentQuestion || !functions) return;
    setQuizSubmitting(true);
    setQuizSelectedOption(optionLabel);
    try {
      const submitAnswer = httpsCallable<
        { challengeId: string; answerLabel: string },
        { correct: boolean; balance: number | null; correctAnswerLabel: string; explanation: string; rewardTokens: number }
      >(functions, 'submitTokenQuizAnswer');
      const { data } = await submitAnswer({ challengeId: currentQuestion.challengeId, answerLabel: optionLabel });
      setQuizAnswered(true);
      setQuizIsCorrect(data.correct);
      setCorrectAnswerLabel(data.correctAnswerLabel);
      setCurrentQuestion((question) => question ? { ...question, explanation: data.explanation, completed: true } : question);
      if (data.correct) {
        await onTokenBalanceRefresh(data.balance ?? undefined).catch((error) => {
          console.warn('[LoungeModal] Serverkonto konnte nach Quizgutschrift nicht aktualisiert werden:', error);
        });
        SoundFxService.playSuccessChime();
        confetti({ particleCount: 50, spread: 50 });
      } else {
        SoundFxService.playWarningTone();
      }
    } catch (error: any) {
      setQuizSelectedOption(null);
      if (error?.code === 'functions/already-exists') {
        setQuizAlreadyCompletedOnLoad(true);
        setQuizAnswered(true);
      } else {
        setQuizError('Deine Antwort konnte nicht sicher übermittelt werden. Bitte versuche es erneut.');
      }
    } finally {
      setQuizSubmitting(false);
    }
  };

  const handleRedeemItem = async (item: ShopItem) => {
    if (tokenBalance < item.cost) {
      SoundFxService.playWarningTone();
      return;
    }

    try {
      if (!functions) {
        throw new Error('Redemption-Dienst ist nicht verfügbar.');
      }

      const redeemVoucher = httpsCallable(functions, 'redeemVoucher');
      const response = await redeemVoucher({ itemId: item.id });
      const data = response.data as { success?: boolean; code?: unknown };
      if (!data.success || typeof data.code !== 'string' || data.code.length === 0) {
        throw new Error('Der Server hat keinen gültigen Redemption-Code zurückgegeben.');
      }
      const returnedCode = data.code;

      // Optimistically update client token UI state
      await onTokenBalanceRefresh();
      SoundFxService.playSuccessChime();
      confetti({ particleCount: 70, spread: 70 });
      setRedeemedCodes((prev) => ({ ...prev, [item.id]: returnedCode }));
    } catch (err: any) {
      console.error('Error redeeming item:', err);
      SoundFxService.playWarningTone();
      alert('Fehler beim Einlösen: ' + (err.message || 'Bitte versuchen Sie es später noch einmal.'));
    }
  };



  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(20, 20, 20, 0.88)',
        backdropFilter: 'blur(16px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: '720px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '24px',
          border: '1px solid var(--accent-gold)',
          boxShadow: 'var(--glow-gold)',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="glow-text-gold">
            <Gamepad2 size={26} />
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
                CHARGE 'N' EARN LADE-LOUNGE
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Verdiene Tokens durch Spiele & Umfragen oder löse sie für Prämien ein
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#8a99ad',
              cursor: 'pointer',
              fontSize: '1.4rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* Current Balance & Level HUD */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            backgroundColor: 'rgba(255, 183, 0, 0.12)',
            borderRadius: '14px',
            border: '1px solid var(--accent-gold)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={20} className="glow-text-gold" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Rang: <strong>E-Bike Scout (Lvl 3)</strong></span>
          </div>

          <div className="glow-text-gold" style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>
            🪙 {tokenBalance} Tokens
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          <button
            onClick={() => setActiveTab('wheel')}
            className={`btn-cyberpunk ${activeTab === 'wheel' ? 'btn-gold' : ''}`}
            style={{ padding: '8px 1px', fontSize: '0.7rem', justifyContent: 'center' }}
          >
            <Dices size={13} /> Glücksrad
          </button>

          <button
            onClick={() => setActiveTab('quests')}
            className={`btn-cyberpunk ${activeTab === 'quests' ? 'btn-gold' : ''}`}
            style={{ padding: '8px 1px', fontSize: '0.7rem', justifyContent: 'center', borderColor: activeTab === 'quests' ? 'var(--accent-gold)' : 'var(--accent-cyan)' }}
          >
            <MapPin size={13} /> Quests
          </button>

          <button
            onClick={() => setActiveTab('catcher')}
            className={`btn-cyberpunk ${activeTab === 'catcher' ? 'btn-gold' : ''}`}
            style={{ padding: '8px 1px', fontSize: '0.7rem', justifyContent: 'center' }}
          >
            <Zap size={13} /> Catcher
          </button>

          <button
            onClick={() => setActiveTab('surveys')}
            className={`btn-cyberpunk ${activeTab === 'surveys' ? 'btn-gold' : ''}`}
            style={{ padding: '8px 1px', fontSize: '0.7rem', justifyContent: 'center' }}
          >
            <FileText size={13} /> Umfragen
          </button>

          <button
            onClick={() => setActiveTab('quiz')}
            className={`btn-cyberpunk ${activeTab === 'quiz' ? 'btn-gold' : ''}`}
            style={{ padding: '8px 1px', fontSize: '0.7rem', justifyContent: 'center' }}
          >
            <HelpCircle size={13} /> Quiz
          </button>

          <button
            onClick={() => setActiveTab('shop')}
            className={`btn-cyberpunk ${activeTab === 'shop' ? 'btn-gold' : ''}`}
            style={{ padding: '8px 1px', fontSize: '0.7rem', justifyContent: 'center' }}
          >
            <ShoppingBag size={13} /> Shop
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`btn-cyberpunk ${activeTab === 'leaderboard' ? 'btn-gold' : ''}`}
            style={{ padding: '8px 1px', fontSize: '0.7rem', justifyContent: 'center' }}
          >
            <Trophy size={13} /> Rangliste
          </button>
        </div>

        {/* 1. Lucky Wheel Tab */}
        {activeTab === 'wheel' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ position: 'relative', width: '220px', height: '220px', margin: '14px auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div
                style={{
                  position: 'absolute',
                  width: '216px',
                  height: '216px',
                  borderRadius: '50%',
                  border: '4px solid var(--accent-gold, #ffb700)',
                  boxShadow: '0 0 20px rgba(255, 183, 0, 0.4)',
                  pointerEvents: 'none',
                }}
              />

              <div
                style={{
                  position: 'absolute',
                  top: '-6px',
                  zIndex: 10,
                  width: 0,
                  height: 0,
                  borderLeft: '14px solid transparent',
                  borderRight: '14px solid transparent',
                  borderTop: '22px solid var(--accent-gold, #ffb700)',
                  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.6))',
                }}
              />

              <div
                style={{
                  width: '200px',
                  height: '200px',
                  borderRadius: '50%',
                  transition: isSpinning ? 'transform 4s cubic-bezier(0.15, 0.85, 0.25, 1)' : 'transform 0.5s ease',
                  transform: `rotate(${rotationDegree}deg)`,
                }}
              >
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
                  <circle cx="100" cy="100" r="14" fill="#05080f" stroke="var(--accent-gold, #ffb700)" strokeWidth="3" />
                  <circle cx="100" cy="100" r="6" fill="var(--accent-gold, #ffb700)" />
                </svg>
              </div>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '14px' }}>
              Drehe am Glücksrad und gewinne kostenlose Tokens für KI-Routen!
            </p>

            <div style={{ display: 'flex', gap: '10px', maxWidth: '400px', margin: '0 auto' }}>
              <button
                onClick={handleSpinWheel}
                disabled={isSpinning || wheelStatusLoading || wheelAlreadySpun}
                className="btn-gold"
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: isSpinning || wheelStatusLoading || wheelAlreadySpun ? 'not-allowed' : 'pointer',
                  opacity: isSpinning || wheelStatusLoading || wheelAlreadySpun ? 0.6 : 1,
                }}
              >
                {wheelStatusLoading ? 'Prüfe Tageslimit…' : isSpinning ? 'Dreht sich...' : wheelAlreadySpun ? 'Heute bereits gedreht' : '🎡 Jetzt Drehen'}
              </button>

            </div>

            {lastWin && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '10px',
                  backgroundColor: lastWin.includes('Niete') ? 'rgba(255, 50, 50, 0.1)' : 'rgba(0, 255, 102, 0.12)',
                  border: lastWin.includes('Niete') ? '1px solid #ff3232' : '1px solid var(--accent-neon-green)',
                  borderRadius: '10px',
                  color: lastWin.includes('Niete') ? '#ff3232' : 'var(--accent-neon-green)',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                }}
              >
                {lastWin}
              </div>
            )}
          </div>
        )}

        {/* 2. Map Quests / Verified Scout Missions Tab */}
        {activeTab === 'quests' && (
          <div style={{ padding: '8px 0' }}>
            {selectedQuest ? (
              <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--accent-gold)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={20} color="var(--accent-gold)" />
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#fff' }}>
                        {selectedQuest.title}
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        📍 {selectedQuest.locationName} • Letztes Update: {selectedQuest.lastUpdatedDate}
                      </p>
                    </div>
                  </div>
                  <span className="glow-text-gold" style={{ fontWeight: 'bold', fontSize: '1rem' }}>
                    Demo-Mission · keine Token-Gutschrift
                  </span>
                </div>

                {/* Verification Source Badge */}
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: selectedQuest.verificationType === 'community_report' ? 'rgba(255, 183, 0, 0.1)' : 'rgba(0, 255, 102, 0.1)',
                    borderRadius: '10px',
                    border: selectedQuest.verificationType === 'community_report' ? '1px solid var(--accent-gold)' : '1px solid #00ff66',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: selectedQuest.verificationType === 'community_report' ? 'var(--accent-gold)' : '#00ff66' }}>
                    <CheckCircle2 size={16} />
                    <span>{selectedQuest.verificationBadgeText}</span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#fff', backgroundColor: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '6px' }}>
                    {selectedQuest.verificationType === 'ride_history' ? 'GPX-Match' : selectedQuest.verificationType === 'community_report' ? 'Community' : 'Live-GPS'}
                  </span>
                </div>

                {/* Community Report Detail Card (if applicable) */}
                {selectedQuest.communityReportInfo && (
                  <div
                    style={{
                      padding: '12px 14px',
                      backgroundColor: 'rgba(0, 230, 163, 0.06)',
                      borderRadius: '12px',
                      border: '1px dashed var(--accent-cyan)',
                      marginBottom: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
                        Meldung von: {selectedQuest.communityReportInfo.reportedBy} ({selectedQuest.communityReportInfo.reportedDate})
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#fff', fontStyle: 'italic' }}>
                      "{selectedQuest.communityReportInfo.details}"
                    </p>
                  </div>
                )}

                {/* Questions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
                  {selectedQuest.questions.map((q, qIdx) => (
                    <div key={qIdx} className="glass-panel" style={{ padding: '12px', borderRadius: '12px' }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--accent-cyan)', marginBottom: '8px' }}>
                        {qIdx + 1}. {q.question}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {q.options.map((opt) => {
                          const isSelected = questAnswers[qIdx] === opt;
                          return (
                            <button
                              key={opt}
                              onClick={() => handleAnswerQuest(qIdx, opt)}
                              className={`btn-cyberpunk ${isSelected ? 'btn-gold' : ''}`}
                              style={{
                                textAlign: 'left',
                                padding: '8px 12px',
                                fontSize: '0.8rem',
                                justifyContent: 'space-between',
                              }}
                            >
                              <span>{opt}</span>
                              {isSelected && <Check size={14} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Interactive Map Pinning Confirmation */}
                <div
                  className="glass-panel"
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: questPinConfirmed ? '1px solid #00ff66' : '1px solid var(--accent-cyan)',
                    backgroundColor: questPinConfirmed ? 'rgba(0, 255, 102, 0.08)' : 'rgba(0, 230, 163, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapIcon size={18} color={questPinConfirmed ? '#00ff66' : 'var(--accent-cyan)'} />
                    <span style={{ fontSize: '0.8rem', color: '#fff' }}>
                      {questPinConfirmed
                        ? 'Demo-Pin gesetzt (keine GPS- oder Serverprüfung)'
                        : 'Demo-Pin markieren (keine Standortprüfung)'}
                    </span>
                  </div>
                  <button
                    onClick={handleConfirmQuestPin}
                    className="btn-cyberpunk"
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      borderColor: questPinConfirmed ? '#00ff66' : 'var(--accent-cyan)',
                      color: questPinConfirmed ? '#00ff66' : 'var(--accent-cyan)',
                    }}
                  >
                    {questPinConfirmed ? 'Demo-Pin gesetzt' : 'Demo-Pin setzen'}
                  </button>
                </div>

                {questNotice && <p role="status" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '10px' }}>{questNotice}</p>}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn-cyberpunk"
                    onClick={() => setSelectedQuest(null)}
                    style={{ flex: 1, padding: '10px', fontSize: '0.8rem', justifyContent: 'center' }}
                  >
                    Abbrechen
                  </button>
                  <button
                    disabled={Object.keys(questAnswers).length < selectedQuest.questions.length || !questPinConfirmed}
                    onClick={handleSubmitQuest}
                    className="btn-cyberpunk btn-gold"
                    style={{
                      flex: 2,
                      padding: '10px',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      justifyContent: 'center',
                      opacity: Object.keys(questAnswers).length < selectedQuest.questions.length || !questPinConfirmed ? 0.4 : 1,
                      cursor: Object.keys(questAnswers).length < selectedQuest.questions.length || !questPinConfirmed ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <CheckCircle2 size={16} /> Verifizierung nicht verfügbar
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    padding: '12px 16px',
                    backgroundColor: 'rgba(0, 230, 163, 0.08)',
                    borderRadius: '14px',
                    border: '1px solid var(--accent-cyan)',
                    marginBottom: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <Compass size={28} className="glow-text-cyan" style={{ flexShrink: 0 }} />
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff' }}>
                      🗺️ Missions-Vorschau (noch nicht serverseitig verfügbar)
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Die folgenden Beispielmissionen sind keine echten Aufträge. Standort, Antworten und Prämien werden derzeit nicht verifiziert oder gutgeschrieben.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                  {MAP_QUESTS.map((quest) => {
                    return (
                      <div
                        key={quest.id}
                        className="glass-panel"
                        style={{
                          padding: '14px',
                          borderRadius: '14px',
                          border: '1px solid var(--accent-gold)',
                          backgroundColor: 'rgba(32, 32, 32, 0.6)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
                              📍 {quest.locationName}
                            </span>
                            <span className="glow-text-gold" style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                              Demo
                            </span>
                          </div>
                          <h5 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
                            {quest.title}
                          </h5>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                            {quest.description}
                          </p>
                          <div style={{ fontSize: '0.65rem', color: '#ffb700', marginTop: '6px' }}>
                            ⚠️ Letzte Messung: {quest.lastUpdatedDate} (Aktualisierung dringend benötigt)
                          </div>
                        </div>

                        <button
                          onClick={() => handleStartQuest(quest)}
                          className="btn-cyberpunk btn-gold"
                          style={{ padding: '8px', fontSize: '0.75rem', justifyContent: 'center' }}
                        >
                          <MapPin size={13} /> Mission ansehen (Demo)
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Surveys remain unavailable until a provider-backed offer and signed reward postback exist. */}
        {activeTab === 'surveys' && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <FileText size={32} style={{ margin: '0 auto 10px' }} />
            <p style={{ fontWeight: 'bold', color: '#fff' }}>Derzeit keine verifizierten Umfragen</p>
            <p style={{ fontSize: '0.8rem', marginTop: '6px' }}>
              Umfrageanbieter und serverseitige Abschlussbestätigung sind noch nicht eingerichtet. Es werden keine Antworten oder Tokens vorgetäuscht.
            </p>
          </div>
        )}

        {/* 3. Watt-Catcher Minigame Tab */}
        {activeTab === 'catcher' && (
          <div style={{ padding: '8px 0', textAlign: 'center' }}>
            {!catcherActive ? (
              <div style={{ padding: '20px', backgroundColor: 'rgba(0, 230, 163, 0.05)', borderRadius: '14px', border: '1px solid var(--border-glass)' }}>
                {catcherFinalScore !== null && <p role="status" style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }}>Punktestand: {catcherFinalScore} · keine Token-Gutschrift (nur lokal berechnet)</p>}
                <Zap size={40} className="glow-text-cyan" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
                  WATT-CATCHER REAKTIONS-GAME
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.4' }}>
                  Tippe auf Energie-Orbs und weiche Glitches aus. Das Spiel läuft lokal; Punkte werden nicht serverseitig geprüft und bringen keine Tokens.
                </p>
                <button className="btn-cyberpunk" onClick={startCatcherGame} style={{ padding: '12px 32px', fontSize: '0.95rem' }}>
                  <Flame size={18} /> Spiel Starten (20s)
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
                    Score: {catcherScore} Punkte
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--accent-gold)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Timer size={16} /> {catcherTimeLeft}s
                  </div>
                </div>

                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '240px',
                    backgroundColor: 'rgba(24, 24, 24, 0.9)',
                    borderRadius: '16px',
                    border: '1px solid var(--accent-cyan)',
                    overflow: 'hidden',
                  }}
                >
                  {catcherOrbs.map((orb) => (
                    <button
                      key={orb.id}
                      onClick={() => handleCatchOrb(orb.id, orb.type)}
                      style={{
                        position: 'absolute',
                        left: `${orb.x}%`,
                        top: `${orb.y}%`,
                        transform: 'translate(-50%, -50%)',
                        width: orb.type === 'super' ? '44px' : '36px',
                        height: orb.type === 'super' ? '44px' : '36px',
                        borderRadius: '50%',
                        border: orb.type === 'super' ? '2px solid #ffb700' : orb.type === 'glitch' ? '2px solid #ff3333' : '2px solid #00ff66',
                        backgroundColor: orb.type === 'super' ? 'rgba(255, 183, 0, 0.4)' : orb.type === 'glitch' ? 'rgba(255, 50, 50, 0.4)' : 'rgba(0, 255, 102, 0.3)',
                        boxShadow: orb.type === 'super' ? '0 0 15px #ffb700' : orb.type === 'glitch' ? '0 0 15px #ff3333' : '0 0 15px #00ff66',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        animation: 'fadeIn 0.2s ease',
                      }}
                    >
                      {orb.type === 'super' ? '⚡' : orb.type === 'glitch' ? '❌' : '🔋'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. Quiz Tab */}
        {activeTab === 'quiz' && (
          <div style={{ padding: '8px 0' }}>
            {quizAlreadyCompletedOnLoad ? (
              <div style={{ padding: '24px 16px', backgroundColor: 'rgba(0, 230, 163, 0.05)', borderRadius: '12px', border: '1px dashed rgba(0, 230, 163, 0.3)', textAlign: 'center' }}>
                <p style={{ fontWeight: 'bold', color: 'var(--accent-cyan)', marginBottom: '8px', fontSize: '1.1rem' }}>
                  🔒 Quiz bereits absolviert
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                  Du hast dein Tagesquiz bereits beantwortet. Komm morgen für eine neue Frage wieder.
                </p>
              </div>
            ) : quizLoading ? (
              <p style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>Tagesquiz wird sicher geladen …</p>
            ) : !currentQuestion ? (
              <p style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>{quizError || 'Das Tagesquiz ist derzeit nicht verfügbar.'}</p>
            ) : (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <HelpCircle size={20} className="glow-text-cyan" />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      E-Bike Trivia (Frage {currentQuestion.questionId}) · {currentQuestion.rewardTokens} Tokens
                    </span>
                  </div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '12px', lineHeight: '1.4' }} className="glow-text-cyan">
                    {currentQuestion.question}
                  </h4>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {currentQuestion.options.map((opt) => {
                    const isSelected = quizSelectedOption === opt.label;
                    const showCorrect = quizAnswered && opt.label === correctAnswerLabel;
                    const showWrong = quizAnswered && isSelected && opt.label !== correctAnswerLabel;

                    let buttonBg = 'rgba(28, 28, 28, 0.8)';
                    let buttonBorder = '1px solid var(--border-glass)';
                    let buttonColor = '#fff';

                    if (quizAnswered) {
                      if (showCorrect) {
                        buttonBg = 'rgba(0, 255, 102, 0.1)';
                        buttonBorder = '1px solid #00ff66';
                        buttonColor = '#00ff66';
                      } else if (showWrong) {
                        buttonBg = 'rgba(255, 50, 50, 0.1)';
                        buttonBorder = '1px solid #ff3232';
                        buttonColor = '#ff3232';
                      }
                    }

                    return (
                      <button
                        key={opt.label}
                        disabled={quizAnswered || quizSubmitting}
                        onClick={() => handleQuizAnswer(opt.label)}
                        style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          backgroundColor: buttonBg,
                          border: buttonBorder,
                          borderRadius: '8px',
                          color: buttonColor,
                          fontSize: '0.9rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          width: '100%',
                          cursor: quizAnswered || quizSubmitting ? 'default' : 'pointer',
                        }}
                      >
                        <span>
                          <strong>{opt.label})</strong> {opt.text}
                        </span>
                        {quizAnswered && opt.label === correctAnswerLabel && <CheckCircle2 size={16} color="#00ff66" />}
                        {quizAnswered && isSelected && opt.label !== correctAnswerLabel && <XCircle size={16} color="#ff3232" />}
                      </button>
                    );
                  })}
                </div>

                {quizAnswered && (
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '12px',
                      backgroundColor: quizIsCorrect ? 'rgba(0, 255, 102, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                      border: quizIsCorrect ? '1px solid rgba(0, 255, 102, 0.3)' : '1px solid var(--border-glass)',
                      borderRadius: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <AlertCircle size={16} color={quizIsCorrect ? '#00ff66' : 'var(--accent-cyan)'} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: quizIsCorrect ? '#00ff66' : 'var(--accent-cyan)' }}>
                        {quizIsCorrect ? `Richtig! ${currentQuestion.rewardTokens} Tokens wurden deinem Konto gutgeschrieben.` : 'Hier ist die Erklärung:'}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.4' }}>
                      {currentQuestion.explanation}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 5. Token Rewards & Purchase Shop Tab */}
        {activeTab === 'shop' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
            {/* Direct Token In-App Purchase Section */}
            <div className="glass-panel" style={{ padding: '14px', borderRadius: '16px', border: '1px solid var(--accent-gold)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <CreditCard size={18} className="glow-text-gold" />
                <h5 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff' }}>
                  Tokenkäufe derzeit nicht verfügbar
                </h5>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                <div style={{ padding: '10px', backgroundColor: 'rgba(255, 183, 0, 0.08)', borderRadius: '10px', border: '1px solid rgba(255, 183, 0, 0.2)' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#fff' }}>☕ Mini-Pack (100 Tok.)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', marginBottom: '8px' }}>1,99 € einmalig</div>
                  <button disabled title="Zahlungsanbieter und Serverbestätigung sind noch nicht eingerichtet" className="btn-cyberpunk btn-gold" style={{ width: '100%', padding: '6px', fontSize: '0.7rem', justifyContent: 'center', opacity: 0.55 }}>
                    Zahlung nicht verfügbar
                  </button>
                </div>

                <div style={{ padding: '10px', backgroundColor: 'rgba(0, 230, 163, 0.08)', borderRadius: '10px', border: '1px solid rgba(0, 230, 163, 0.2)' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#fff' }}>🚀 Power-Pack (500 Tok.)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', marginBottom: '8px' }}>4,99 € (Beliebt)</div>
                  <button disabled title="Zahlungsanbieter und Serverbestätigung sind noch nicht eingerichtet" className="btn-cyberpunk" style={{ width: '100%', padding: '6px', fontSize: '0.7rem', justifyContent: 'center', opacity: 0.55 }}>
                    Zahlung nicht verfügbar
                  </button>
                </div>

                <div style={{ padding: '10px', backgroundColor: 'rgba(255, 0, 127, 0.08)', borderRadius: '10px', border: '1px solid rgba(255, 0, 127, 0.2)' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#fff' }}>👑 Supporter Pro</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-pink)', marginBottom: '8px' }}>9,99 € Lifetime</div>
                  <button disabled title="Zahlungsanbieter und Serverbestätigung sind noch nicht eingerichtet" className="btn-cyberpunk" style={{ width: '100%', padding: '6px', fontSize: '0.7rem', justifyContent: 'center', borderColor: 'var(--accent-pink)', color: 'var(--accent-pink)', opacity: 0.55 }}>
                    Freischalten (9,99 €)
                  </button>
                </div>
              </div>
            </div>

            {/* Redeemable Rewards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
              {SHOP_ITEMS.map((item) => {
                const isRedeemed = !!redeemedCodes[item.id];
                const canAfford = tokenBalance >= item.cost;

                return (
                  <div
                    key={item.id}
                    className="glass-panel"
                    style={{
                      padding: '14px',
                      borderRadius: '16px',
                      border: '1px solid var(--border-glass)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '10px',
                      backgroundColor: 'rgba(32, 32, 32, 0.6)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '1.6rem' }}>{item.icon}</span>
                        <span className="glow-text-gold" style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                          🪙 {item.cost} Tokens
                        </span>
                      </div>
                      <h5 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
                        {item.title}
                      </h5>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                        {item.description}
                      </p>
                    </div>

                    {isRedeemed ? (
                      <div
                        style={{
                          padding: '8px',
                          backgroundColor: 'rgba(0, 255, 102, 0.1)',
                          border: '1px solid #00ff66',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          color: '#00ff66',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>Code: <strong>{redeemedCodes[item.id]}</strong></span>
                        <QrCode size={16} />
                      </div>
                    ) : (
                      <button
                        disabled={!canAfford}
                        onClick={() => handleRedeemItem(item)}
                        className={`btn-cyberpunk ${canAfford ? 'btn-gold' : ''}`}
                        style={{
                          padding: '8px',
                          fontSize: '0.75rem',
                          justifyContent: 'center',
                          opacity: canAfford ? 1 : 0.5,
                          cursor: canAfford ? 'pointer' : 'not-allowed',
                        }}
                      >
                        <Sparkles size={14} /> Jetzt Einlösen
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* B2B Partner Pitch Button */}
            <div
              className="glass-panel"
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 183, 0, 0.08)',
                border: '1px solid rgba(255, 183, 0, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={20} className="glow-text-gold" />
                <span style={{ fontSize: '0.8rem', color: '#fff' }}>
                  Besitzt du ein Café oder eine Werkstatt? <strong>Werde offizieller Partner-Lade-Stopp!</strong>
                </span>
              </div>
              <button
                onClick={() => setShowPartnerModal(true)}
                className="btn-cyberpunk btn-gold"
                style={{ padding: '6px 14px', fontSize: '0.75rem' }}
              >
                Als Partner registrieren
              </button>
            </div>
          </div>
        )}

        {/* 6. Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div style={{ padding: '8px 0' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '10px' }}>Demo-Rangliste · keine Live-Kontodaten</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {LEADERBOARD_DATA.map((entry) => (
                <div
                  key={entry.rank}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    backgroundColor: entry.isUser ? 'rgba(0, 230, 163, 0.15)' : 'rgba(32, 32, 32, 0.5)',
                    border: entry.isUser ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '1rem', width: '20px', color: entry.rank <= 3 ? 'var(--accent-gold)' : 'var(--text-muted)' }}>
                      #{entry.rank}
                    </span>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: entry.isUser ? 'var(--accent-cyan)' : '#fff' }}>
                        {entry.name}
                      </div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--accent-gold)' }}>
                        {entry.badge}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div className="glow-text-gold" style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                      🪙 {entry.tokens}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {entry.scans} Stationen
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* B2B Partner Lead Modal */}
      {showPartnerModal && (
        <PartnerModal isOpen={showPartnerModal} onClose={() => setShowPartnerModal(false)} />
      )}
    </div>
  );
};
