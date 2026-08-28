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
  Video,
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
import { SpatialTelemetrySanitizerService } from '../../services/spatialTelemetrySanitizerService';
import { SurveyWallService, type AvailableSurvey } from '../../services/surveyWallService';
import { SPONSOR_ADS, type SponsorAd } from '../../services/adService';
import { PartnerModal } from './PartnerModal';

interface LoungeModalProps {
  tokenBalance: number;
  onAddTokens: (amount: number) => void;
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
  id: number;
  question: string;
  options: { label: string; text: string; isCorrect: boolean }[];
  explanation: string;
}

interface ShopItem {
  id: string;
  title: string;
  cost: number;
  category: 'voucher' | 'style' | 'perk';
  icon: string;
  description: string;
  code?: string;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  scans: number;
  tokens: number;
  badge: string;
  isUser?: boolean;
}

const quizQuestions: TriviaQuestion[] = [
  {
    id: 1,
    question: 'Wie schont man den E-Bike-Akku am Berg am besten?',
    options: [
      { label: 'A', text: 'Hohe Trittfrequenz (70-80 RPM) & mittlere Motorstufe', isCorrect: true },
      { label: 'B', text: 'Niedrige Trittfrequenz im höchsten Gang im Turbo-Modus', isCorrect: false },
      { label: 'C', text: 'Gleichmäßiges Bremsen bei gleichzeitigem Vollgas-Treten', isCorrect: false },
    ],
    explanation: 'Eine höhere Trittfrequenz entlastet den Motor und schont die Akkuzellen vor Überhitzung und schnellem Entladen.',
  },
  {
    id: 2,
    question: 'Bei welcher Temperatur fühlt sich ein Lithium-Ionen-Akku am wohlsten?',
    options: [
      { label: 'A', text: 'Bei frostigen Temperaturen unter 0°C', isCorrect: false },
      { label: 'B', text: 'Bei Zimmertemperatur (15°C bis 25°C)', isCorrect: true },
      { label: 'C', text: 'Unter praller Sonne bei über 40°C', isCorrect: false },
    ],
    explanation: 'Extreme Kälte verringert die Kapazität temporär, extreme Hitze schädigt die Akkuzellen dauerhaft. 15-25°C sind optimal.',
  },
  {
    id: 3,
    question: 'Wie lagert man einen E-Bike-Akku optimal über den Winter?',
    options: [
      { label: 'A', text: 'Komplett leergefahren (0%) im kalten Keller', isCorrect: false },
      { label: 'B', text: 'Vollständig geladen (100%) in der warmen Wohnung', isCorrect: false },
      { label: 'C', text: 'Bei ca. 30% bis 60% Ladestand an einem kühlen, trockenen Ort', isCorrect: true },
    ],
    explanation: 'Ein mittlerer Ladestand verhindert Tiefentladung und schont die Chemie, da die Zellspannung nicht auf Extremwerten liegt.',
  },
  {
    id: 4,
    question: 'Welchen Vorteil bietet eine vorausschauende Routenplanung für E-Bikes?',
    options: [
      { label: 'A', text: 'Sie spart bis zu 30% Akku durch Vermeidung extremer Steigungen', isCorrect: true },
      { label: 'B', text: 'Sie erhöht die Maximalgeschwindigkeit des Motors auf 45 km/h', isCorrect: false },
      { label: 'C', text: 'Sie lädt den Akku durch Solarenergie während der Fahrt auf', isCorrect: false },
    ],
    explanation: 'Durch smarte Routenplanung mit geringeren Steigungen kann die Unterstützungsstufe gesenkt und viel Energie gespart werden.',
  },
  {
    id: 5,
    question: 'Was erhöht die Reichweite deines E-Bikes am effektivsten?',
    options: [
      { label: 'A', text: 'Fahren mit minimalem Reifendruck', isCorrect: false },
      { label: 'B', text: 'Optimaler Reifendruck und regelmäßiges Ölen der Kette', isCorrect: true },
      { label: 'C', text: 'Tragen von besonders schwerem Gepäck', isCorrect: false },
    ],
    explanation: 'Ein optimaler Reifendruck verringert den Rollwiderstand drastisch, sodass weniger Motorunterstützung nötig ist.',
  },
];

const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'coffee-pass',
    title: '1x Bio-Kaffee im Bike-Café',
    cost: 40,
    category: 'voucher',
    icon: '☕',
    description: 'Gültig bei über 45 Partner-Cafés und E-Bike Ladestationen entlang der Hauptradwege.',
    code: 'WEGWEISER-KAFFEE-2026',
  },
  {
    id: 'cyber-skin',
    title: 'Hologramm Neon-Kartenstil',
    cost: 75,
    category: 'style',
    icon: '🗺️',
    description: 'Schaltet den ultra-kontrastreichen Cyber-Glow Vektorkartenstil für Nachtfahrten frei.',
    code: 'SKIN-HOLO-CYBER',
  },
  {
    id: 'service-discount',
    title: '15% E-Bike Werkstatt-Rabatt',
    cost: 100,
    category: 'voucher',
    icon: '🔧',
    description: '15% Preisnachlass auf Inspektion, Bremsenservice oder Akku-Check bei Partnerwerkstätten.',
    code: 'WERKSTATT-15-PRO',
  },
  {
    id: 'super-cloud-pass',
    title: 'VIP Vertex AI Super-Route',
    cost: 25,
    category: 'perk',
    icon: '⚡',
    description: 'Priorisierte KI-Routenberechnung mit Windwiderstands- und Steigungssimulation.',
    code: 'VERTEX-VIP-BURST',
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

const COOLDOWN_KEY = 'lounge_wheel_cooldown';
const QUIZ_ATTEMPT_KEY = 'lounge_quiz_attempted';

export const LoungeModal: React.FC<LoungeModalProps> = ({ tokenBalance, onAddTokens, onClose }) => {
  const [activeTab, setActiveTab] = useState<'wheel' | 'quests' | 'catcher' | 'surveys' | 'quiz' | 'shop' | 'leaderboard'>('wheel');
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotationDegree, setRotationDegree] = useState(0);
  const [lastWin, setLastWin] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // Map Quests State
  const [selectedQuest, setSelectedQuest] = useState<MapQuest | null>(null);
  const [questAnswers, setQuestAnswers] = useState<Record<number, string>>({});
  const [completedQuestIds, setCompletedQuestIds] = useState<string[]>([]);
  const [questPinConfirmed, setQuestPinConfirmed] = useState(false);

  // Digital Token Pack Checkout State (§ 356 Abs. 5 BGB Compliance)
  const [pendingPurchase, setPendingPurchase] = useState<{ amount: number; priceEur: string } | null>(null);
  const [consentInstantDelivery, setConsentInstantDelivery] = useState(false);
  const [consentWaiverRight, setConsentWaiverRight] = useState(false);

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

  const handleSubmitQuest = async () => {
    if (!selectedQuest) return;

    // Credit Token Bounty
    onAddTokens(selectedQuest.bountyTokens);
    SoundFxService.playSuccessChime();
    confetti({ particleCount: 80, spread: 80 });

    // Anonymously sanitize and merge verified intelligence into collective map
    await SpatialTelemetrySanitizerService.sanitizeAndMergeTrack(
      [[selectedQuest.lat, selectedQuest.lng], [selectedQuest.lat + 0.002, selectedQuest.lng + 0.002]],
      20,
      1.2,
      15
    );

    setCompletedQuestIds((prev) => [...prev, selectedQuest.id]);
    setSelectedQuest(null);
  };

  // Rewarded Video Ad Modal State
  const [showVideoAd, setShowVideoAd] = useState(false);
  const [adTimeLeft, setAdTimeLeft] = useState(15);
  const [currentAd, setCurrentAd] = useState<SponsorAd>(SPONSOR_ADS[0]);

  // Survey State
  const [surveys] = useState<AvailableSurvey[]>(SurveyWallService.getAvailableSurveys());
  const [activeSurvey, setActiveSurvey] = useState<AvailableSurvey | null>(null);
  const [surveyStep, setSurveyStep] = useState(1);
  const [completedSurveys, setCompletedSurveys] = useState<string[]>([]);

  // B2B Partner Modal State
  const [showPartnerModal, setShowPartnerModal] = useState(false);

  // Watt-Catcher Game State
  const [catcherActive, setCatcherActive] = useState(false);
  const [catcherScore, setCatcherScore] = useState(0);
  const [catcherTimeLeft, setCatcherTimeLeft] = useState(20);
  const [catcherOrbs, setCatcherOrbs] = useState<{ id: number; x: number; y: number; type: 'energy' | 'super' | 'glitch' }[]>([]);

  // Shop state
  const [redeemedCodes, setRedeemedCodes] = useState<Record<string, string>>({});

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

  // Wheel Sectors (Fair balance: max 10 tokens, lower than active live scouting)
  const sectors = [
    { label: '+8 Tok.', amount: 8, color: '#111c30', strokeColor: '#ffb700', textColor: '#ffb700', fullLabel: '🪙 +8 Tokens gewonnen! Toller Pausengewinn! 🎉' },
    { label: 'Niete', amount: 0, color: '#090d16', strokeColor: '#1e293b', textColor: '#64748b', fullLabel: 'Leider eine Niete erwischt! Beim nächsten Mal klappt es bestimmt. 😉' },
    { label: '+5 Tok.', amount: 5, color: '#0c2533', strokeColor: '#00f0ff', textColor: '#00f0ff', fullLabel: '🪙 +5 Tokens gewonnen! Dranbleiben! 🚀' },
    { label: 'Niete', amount: 0, color: '#090d16', strokeColor: '#1e293b', textColor: '#64748b', fullLabel: 'Leider eine Niete erwischt! Beim nächsten Mal klappt es bestimmt. 😉' },
    { label: '+2 Tok.', amount: 2, color: '#1a102f', strokeColor: '#b026ff', textColor: '#b026ff', fullLabel: '🪙 +2 Tokens gewonnen! Kleinvieh macht auch Mist! 🔋' },
    { label: 'Niete', amount: 0, color: '#090d16', strokeColor: '#1e293b', textColor: '#64748b', fullLabel: 'Leider eine Niete erwischt! Beim nächsten Mal klappt es bestimmt. 😉' },
    { label: '+10 Tok.', amount: 10, color: '#0c2533', strokeColor: '#00f0ff', textColor: '#00f0ff', fullLabel: '🪙 +10 Tokens gewonnen! Großartig! 🌟' },
    { label: 'Niete', amount: 0, color: '#090d16', strokeColor: '#1e293b', textColor: '#64748b', fullLabel: 'Leider eine Niete erwischt! Beim nächsten Mal klappt es bestimmt. 😉' },
  ];

  const playDeceleratingTicks = (delay: number) => {
    if (delay > 600) return;
    SoundFxService.playClick();
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

  // Video Ad Countdown Timer
  useEffect(() => {
    if (!showVideoAd) return;
    setAdTimeLeft(15);

    const timer = setInterval(() => {
      setAdTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showVideoAd]);

  const handleStartVideoAd = () => {
    SoundFxService.playClick();
    const randomAd = SPONSOR_ADS[Math.floor(Math.random() * SPONSOR_ADS.length)];
    setCurrentAd(randomAd);
    setShowVideoAd(true);
  };

  const handleCompleteVideoAd = () => {
    setShowVideoAd(false);
    onAddTokens(currentAd.rewardTokens);
    SoundFxService.playSuccessChime();
    confetti({ particleCount: 70, spread: 70 });

    // Reset wheel cooldown
    localStorage.removeItem(COOLDOWN_KEY);
    setCooldownRemaining(0);
  };

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
    setCatcherTimeLeft(20);
    setCatcherOrbs([]);
    setCatcherActive(true);
  };

  const endCatcherGame = () => {
    setCatcherActive(false);
    setCatcherOrbs([]);
    const earned = Math.min(10, Math.floor(catcherScore / 3));
    if (earned > 0) {
      onAddTokens(earned);
      SoundFxService.playSuccessChime();
      confetti({ particleCount: 60, spread: 60 });
    }
  };

  const handleCatchOrb = (id: number, type: 'energy' | 'super' | 'glitch') => {
    setCatcherOrbs((prev) => prev.filter((o) => o.id !== id));
    if (type === 'energy') {
      setCatcherScore((s) => s + 2);
      SoundFxService.playClick();
    } else if (type === 'super') {
      setCatcherScore((s) => s + 5);
      SoundFxService.playTurnChime();
    } else if (type === 'glitch') {
      setCatcherScore((s) => Math.max(0, s - 3));
      SoundFxService.playWarningTone();
    }
  };

  const handleSpinWheel = () => {
    if (isSpinning || cooldownRemaining > 0) return;
    setIsSpinning(true);
    setLastWin(null);

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
        SoundFxService.playSuccessChime();
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
      } else {
        SoundFxService.playWarningTone();
      }

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
      onAddTokens(6);
      SoundFxService.playSuccessChime();
      confetti({ particleCount: 50, spread: 50 });
    } else {
      SoundFxService.playWarningTone();
    }
  };

  const handleRedeemItem = (item: ShopItem) => {
    if (tokenBalance < item.cost) {
      SoundFxService.playWarningTone();
      return;
    }

    onAddTokens(-item.cost);
    SoundFxService.playSuccessChime();
    confetti({ particleCount: 70, spread: 70 });
    setRedeemedCodes((prev) => ({ ...prev, [item.id]: item.code || 'REDEEMED-2026' }));
  };

  const handleInitiateBuyTokenPack = (amount: number, priceEur: string) => {
    SoundFxService.playClick();
    setPendingPurchase({ amount, priceEur });
    setConsentInstantDelivery(false);
    setConsentWaiverRight(false);
  };

  const handleConfirmPurchase = () => {
    if (!pendingPurchase || !consentInstantDelivery || !consentWaiverRight) {
      SoundFxService.playWarningTone();
      return;
    }

    // Compliant receipt logging according to § 356 Abs. 5 BGB
    const receipt = {
      timestamp: new Date().toISOString(),
      pack: `${pendingPurchase.amount} Tokens`,
      price: pendingPurchase.priceEur,
      consentInstantDelivery: true,
      consentWaiverRightOfWithdrawal: true,
      legalBasis: '§ 356 Abs. 5 BGB',
    };
    const existing = JSON.parse(localStorage.getItem('wegweiser_token_purchases') || '[]');
    localStorage.setItem('wegweiser_token_purchases', JSON.stringify([...existing, receipt]));

    onAddTokens(pendingPurchase.amount);
    SoundFxService.playSuccessChime();
    confetti({ particleCount: 80, spread: 80 });
    alert(`🎉 Kauf erfolgreich! +${pendingPurchase.amount} Tokens gutgeschrieben. Vielen Dank für deinen Support!`);
    setPendingPurchase(null);
  };

  const handleStartSurvey = (survey: AvailableSurvey) => {
    SoundFxService.playClick();
    setActiveSurvey(survey);
    setSurveyStep(1);
  };

  const handleCompleteSurveyStep = () => {
    if (!activeSurvey) return;
    if (surveyStep < 3) {
      SoundFxService.playClick();
      setSurveyStep((s) => s + 1);
    } else {
      onAddTokens(activeSurvey.tokenReward);
      SoundFxService.playSuccessChime();
      confetti({ particleCount: 80, spread: 80 });
      setCompletedSurveys((prev) => [...prev, activeSurvey.id]);
      setActiveSurvey(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 15, 0.88)',
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
                disabled={isSpinning || cooldownRemaining > 0}
                className="btn-gold"
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: isSpinning || cooldownRemaining > 0 ? 'not-allowed' : 'pointer',
                  opacity: isSpinning || cooldownRemaining > 0 ? 0.6 : 1,
                }}
              >
                {isSpinning ? 'Dreht sich...' : cooldownRemaining > 0 ? `Abkühlen (${cooldownRemaining}s)` : '🎡 Jetzt Drehen'}
              </button>

              {/* Rewarded Video Ad Booster Button */}
              <button
                onClick={handleStartVideoAd}
                className="btn-cyberpunk"
                style={{ padding: '12px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="15s Sponsor-Video ansehen für +20 Tokens & Cooldown Reset"
              >
                <Video size={16} /> +20 Tok. Clip
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
                    🪙 +{selectedQuest.bountyTokens} Tokens
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
                      backgroundColor: 'rgba(0, 240, 255, 0.06)',
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
                    backgroundColor: questPinConfirmed ? 'rgba(0, 255, 102, 0.08)' : 'rgba(0, 240, 255, 0.05)',
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
                        ? '✓ GPS-Koordinaten & Markierung auf Karte bestätigt'
                        : 'Exakte Position auf der Karte markieren / bestätigen'}
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
                    {questPinConfirmed ? 'Pin gesetzt ✓' : 'Pin setzen'}
                  </button>
                </div>

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
                    <CheckCircle2 size={16} /> Verifizierung Absenden (+{selectedQuest.bountyTokens} Tokens)
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    padding: '12px 16px',
                    backgroundColor: 'rgba(0, 240, 255, 0.08)',
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
                      🗺️ Verifizierte Community-Map-Quests (Scout-Prämien)
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Hilf mit, veraltete Straßenbeläge, Anstiege &amp; Ladepunkte vor Ort zu verifizieren. Nach erfolgreichem GPS-Plausibilitätstest erhältst du sofort deine Token-Prämie!
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                  {MAP_QUESTS.map((quest) => {
                    const isDone = completedQuestIds.includes(quest.id);
                    return (
                      <div
                        key={quest.id}
                        className="glass-panel"
                        style={{
                          padding: '14px',
                          borderRadius: '14px',
                          border: isDone ? '1px solid rgba(0, 255, 102, 0.3)' : '1px solid var(--accent-gold)',
                          backgroundColor: isDone ? 'rgba(0, 255, 102, 0.05)' : 'rgba(15, 22, 36, 0.6)',
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
                              🪙 +{quest.bountyTokens} Tokens
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

                        {isDone ? (
                          <div style={{ fontSize: '0.75rem', color: '#00ff66', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                            <CheckCircle2 size={14} /> Verifiziert &amp; Belohnung ausgezahlt ✓
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartQuest(quest)}
                            className="btn-cyberpunk btn-gold"
                            style={{ padding: '8px', fontSize: '0.75rem', justifyContent: 'center' }}
                          >
                            <MapPin size={13} /> Vor Ort Verifizieren (+{quest.bountyTokens} Tok.)
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. Paid Surveys Offerwall Tab */}
        {activeTab === 'surveys' && (
          <div style={{ padding: '8px 0' }}>
            {activeSurvey ? (
              <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--accent-gold)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>
                    {activeSurvey.title} (Frage {surveyStep}/3)
                  </h4>
                  <span className="glow-text-gold" style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                    🪙 +{activeSurvey.tokenReward} Tokens
                  </span>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  {surveyStep === 1 && (
                    <div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
                        Wie häufig fährst du durchschnittlich mit dem E-Bike oder Fahrrad?
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {['Täglich zum Pendeln', '2-3 Mal pro Woche', 'Nur am Wochenende für Touren', 'Gelegentlich im Urlaub'].map((ans) => (
                          <button key={ans} onClick={handleCompleteSurveyStep} className="btn-cyberpunk" style={{ textAlign: 'left', padding: '10px 14px' }}>
                            {ans}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {surveyStep === 2 && (
                    <div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
                        Wie wichtig ist dir eine verlässliche Anzeige von öffentlichen E-Bike Ladepunkten?
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {['Extrem wichtig für längere Tagestouren', 'Wichtig als Sicherheitsreserve', 'Eher zweitrangig'].map((ans) => (
                          <button key={ans} onClick={handleCompleteSurveyStep} className="btn-cyberpunk" style={{ textAlign: 'left', padding: '10px 14px' }}>
                            {ans}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {surveyStep === 3 && (
                    <div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
                        Welche Akkukapazität hat dein Haupt-E-Bike?
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {['Unter 500 Wh', '500 Wh bis 625 Wh', '750 Wh oder mehr (Dual-Battery)', 'Weiß ich nicht genau'].map((ans) => (
                          <button key={ans} onClick={handleCompleteSurveyStep} className="btn-cyberpunk btn-gold" style={{ textAlign: 'left', padding: '10px 14px' }}>
                            {ans} (Umfrage abschließen)
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Verdiene echte Tokens während der Ladepause durch kurze Marktforschungs-Umfragen:
                  </p>
                  <a
                    href={SurveyWallService.getOfferwallUrl('user-1')}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    BitLabs Wall <ExternalLink size={12} />
                  </a>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                  {surveys.map((sv) => {
                    const isDone = completedSurveys.includes(sv.id);
                    return (
                      <div
                        key={sv.id}
                        className="glass-panel"
                        style={{
                          padding: '14px',
                          borderRadius: '14px',
                          border: isDone ? '1px solid rgba(0, 255, 102, 0.3)' : '1px solid var(--border-glass)',
                          backgroundColor: isDone ? 'rgba(0, 255, 102, 0.05)' : 'rgba(15, 22, 36, 0.6)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '8px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', fontWeight: 'bold' }}>
                              ⏱️ {sv.durationMinutes} Min • ⭐ {sv.rating}
                            </span>
                            <span className="glow-text-gold" style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                              🪙 +{sv.tokenReward} Tokens
                            </span>
                          </div>
                          <h5 style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fff', marginBottom: '2px' }}>
                            {sv.title}
                          </h5>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Thema: {sv.topic}
                          </p>
                        </div>

                        {isDone ? (
                          <div style={{ fontSize: '0.75rem', color: '#00ff66', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                            <CheckCircle2 size={14} /> Abgeschlossen & gutgeschrieben
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartSurvey(sv)}
                            className="btn-cyberpunk btn-gold"
                            style={{ padding: '8px', fontSize: '0.75rem', justifyContent: 'center' }}
                          >
                            <Play size={12} fill="currentColor" /> Umfrage Starten (+{sv.tokenReward} Tok.)
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. Watt-Catcher Minigame Tab */}
        {activeTab === 'catcher' && (
          <div style={{ padding: '8px 0', textAlign: 'center' }}>
            {!catcherActive ? (
              <div style={{ padding: '20px', backgroundColor: 'rgba(0, 240, 255, 0.05)', borderRadius: '14px', border: '1px solid var(--border-glass)' }}>
                <Zap size={40} className="glow-text-cyan" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
                  WATT-CATCHER REAKTIONS-GAME
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.4' }}>
                  Tippe so schnell wie möglich auf grüne 🟢 Energie-Orbs und gelbe ⚡ Super-Blitze. Meide rote Glitches! Erziele Punkte für echte In-App Tokens.
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
                    backgroundColor: 'rgba(5, 12, 24, 0.9)',
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
              <div style={{ padding: '24px 16px', backgroundColor: 'rgba(0, 240, 255, 0.05)', borderRadius: '12px', border: '1px dashed rgba(0, 240, 255, 0.3)', textAlign: 'center' }}>
                <p style={{ fontWeight: 'bold', color: 'var(--accent-cyan)', marginBottom: '8px', fontSize: '1.1rem' }}>
                  🔒 Quiz bereits absolviert
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                  Du hast dein Quiz-Guthaben für diese Session bereits eingelöst! Lade dein E-Bike weiter auf und komm bei der nächsten Fahrt wieder vorbei.
                </p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <HelpCircle size={20} className="glow-text-cyan" />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      E-Bike Trivia (Frage #{currentQuestion.id})
                    </span>
                  </div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '12px', lineHeight: '1.4' }} className="glow-text-cyan">
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
                        disabled={quizAnswered}
                        onClick={() => handleQuizAnswer(opt.label, opt.isCorrect)}
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
                          cursor: quizAnswered ? 'default' : 'pointer',
                        }}
                      >
                        <span>
                          <strong>{opt.label})</strong> {opt.text}
                        </span>
                        {quizAnswered && opt.isCorrect && <CheckCircle2 size={16} color="#00ff66" />}
                        {quizAnswered && isSelected && !opt.isCorrect && <XCircle size={16} color="#ff3232" />}
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
                        {quizIsCorrect ? 'Hervorragend! Richtig geantwortet (+15 Tokens).' : 'Hier ist die Erklärung:'}
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
                  Token-Packs Sofort Kaufen (Direkt-Gutschrift)
                </h5>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                <div style={{ padding: '10px', backgroundColor: 'rgba(255, 183, 0, 0.08)', borderRadius: '10px', border: '1px solid rgba(255, 183, 0, 0.2)' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#fff' }}>☕ Mini-Pack (100 Tok.)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', marginBottom: '8px' }}>1,99 € einmalig</div>
                  <button onClick={() => handleInitiateBuyTokenPack(100, '1,99 €')} className="btn-cyberpunk btn-gold" style={{ width: '100%', padding: '6px', fontSize: '0.7rem', justifyContent: 'center' }}>
                    Kaufen (1,99 €)
                  </button>
                </div>

                <div style={{ padding: '10px', backgroundColor: 'rgba(0, 240, 255, 0.08)', borderRadius: '10px', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#fff' }}>🚀 Power-Pack (500 Tok.)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', marginBottom: '8px' }}>4,99 € (Beliebt)</div>
                  <button onClick={() => handleInitiateBuyTokenPack(500, '4,99 €')} className="btn-cyberpunk" style={{ width: '100%', padding: '6px', fontSize: '0.7rem', justifyContent: 'center' }}>
                    Kaufen (4,99 €)
                  </button>
                </div>

                <div style={{ padding: '10px', backgroundColor: 'rgba(255, 0, 127, 0.08)', borderRadius: '10px', border: '1px solid rgba(255, 0, 127, 0.2)' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#fff' }}>👑 Supporter Pro</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-pink)', marginBottom: '8px' }}>9,99 € Lifetime</div>
                  <button onClick={() => handleInitiateBuyTokenPack(2000, '9,99 €')} className="btn-cyberpunk" style={{ width: '100%', padding: '6px', fontSize: '0.7rem', justifyContent: 'center', borderColor: 'var(--accent-pink)', color: 'var(--accent-pink)' }}>
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
                      backgroundColor: 'rgba(15, 22, 36, 0.6)',
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
                    backgroundColor: entry.isUser ? 'rgba(0, 240, 255, 0.15)' : 'rgba(15, 22, 36, 0.5)',
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

      {/* Rewarded Sponsor Video Ad Modal */}
      {showVideoAd && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            zIndex: 3000,
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
              maxWidth: '480px',
              padding: '24px',
              borderRadius: '20px',
              border: '2px solid var(--accent-gold)',
              boxShadow: '0 0 40px rgba(255, 183, 0, 0.4)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Sponsor Video Clip • {currentAd.sponsorName}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                <Timer size={16} /> {adTimeLeft > 0 ? `${adTimeLeft}s` : 'Belohnung bereit!'}
              </div>
            </div>

            <div
              style={{
                height: '180px',
                borderRadius: '14px',
                backgroundColor: 'rgba(255, 183, 0, 0.1)',
                border: '1px dashed var(--accent-gold)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                gap: '8px',
              }}
            >
              <Video size={48} className="glow-text-gold" />
              <h4 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>
                {currentAd.headline}
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                {currentAd.tagline}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <a
                href={currentAd.url}
                target="_blank"
                rel="noreferrer"
                className="btn-cyberpunk"
                style={{ flex: 1, padding: '10px', fontSize: '0.8rem', justifyContent: 'center', textDecoration: 'none' }}
              >
                {currentAd.buttonText}
              </a>

              <button
                disabled={adTimeLeft > 0}
                onClick={handleCompleteVideoAd}
                className="btn-cyberpunk btn-gold"
                style={{
                  flex: 1,
                  padding: '10px',
                  fontSize: '0.8rem',
                  justifyContent: 'center',
                  opacity: adTimeLeft > 0 ? 0.4 : 1,
                  cursor: adTimeLeft > 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {adTimeLeft > 0 ? `Warte ${adTimeLeft}s` : '🪙 +20 Tokens Einlösen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Digital Content Checkout Confirmation Modal (§ 356 Abs. 5 BGB / Verbraucherrechte) */}
      {pendingPurchase && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 10, 20, 0.94)',
            backdropFilter: 'blur(16px)',
            zIndex: 3500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              borderRadius: '20px',
              border: '2px solid var(--accent-gold)',
              boxShadow: 'var(--glow-gold)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 183, 0, 0.2)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="glow-text-gold">
                <CreditCard size={22} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Kaufabschluss &amp; Widerruf</h3>
              </div>
              <button
                onClick={() => setPendingPurchase(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'rgba(255, 183, 0, 0.08)', borderRadius: '12px', border: '1px solid rgba(255, 183, 0, 0.2)' }}>
              <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.95rem' }}>
                Ausgewählt: +{pendingPurchase.amount} Tokens ({pendingPurchase.priceEur})
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Sofortige Gutschrift auf dein In-App Token-Konto
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.75rem', color: '#fff', lineHeight: '1.4' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={consentInstantDelivery}
                  onChange={(e) => setConsentInstantDelivery(e.target.checked)}
                  style={{ marginTop: '3px' }}
                />
                <span>
                  Ich verlange und stimme ausdrücklich zu, dass der Anbieter vor Ablauf der 14-tägigen Widerrufsfrist mit der Ausführung des Vertrags (Bereitstellung der digitalen Tokens) beginnt.
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={consentWaiverRight}
                  onChange={(e) => setConsentWaiverRight(e.target.checked)}
                  style={{ marginTop: '3px' }}
                />
                <span>
                  Mir ist bekannt, dass ich durch diese Zustimmung mit Beginn der Ausführung des Vertrags mein gesetzliches Widerrufsrecht für diese digitalen Inhalte verliere (§ 356 Abs. 5 BGB).
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                onClick={() => setPendingPurchase(null)}
                className="btn-cyberpunk"
                style={{ flex: 1, padding: '10px', fontSize: '0.8rem', justifyContent: 'center' }}
              >
                Abbrechen
              </button>
              <button
                disabled={!consentInstantDelivery || !consentWaiverRight}
                onClick={handleConfirmPurchase}
                className="btn-cyberpunk btn-gold"
                style={{
                  flex: 1.5,
                  padding: '10px',
                  fontSize: '0.8rem',
                  justifyContent: 'center',
                  opacity: (!consentInstantDelivery || !consentWaiverRight) ? 0.4 : 1,
                  cursor: (!consentInstantDelivery || !consentWaiverRight) ? 'not-allowed' : 'pointer',
                }}
              >
                Jetzt Kaufen ({pendingPurchase.priceEur})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* B2B Partner Lead Modal */}
      {showPartnerModal && (
        <PartnerModal isOpen={showPartnerModal} onClose={() => setShowPartnerModal(false)} />
      )}
    </div>
  );
};
