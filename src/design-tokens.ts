/**
 * Design Tokens — Single Source of Truth für Farben, Radien und Abstände.
 * 
 * Diese Datei ist die Brücke zwischen Figma-Export und CSS-Variablen.
 * Beim Design-Import:
 *   1. Figma-Token-Werte hier aktualisieren
 *   2. Entsprechende CSS-Variable in src/index.css anpassen
 * 
 * Alle Werte müssen 1:1 mit den CSS-Variablen in index.css (:root) übereinstimmen.
 */
export const designTokens = {
  /** Primäre Markenfarben */
  color: {
    // Neon-Akzente (Design Freeze v88)
    accentCyan:        '#00E5FF',  // --accent-cyan
    accentCyanDark:    '#00a8e8',  // --accent-cyan-dark
    accentGold:        '#ffb700',  // --accent-gold
    accentPink:        '#ff007f',  // --accent-pink
    accentGreen:       '#00ff66',  // --accent-neon-green
    accentDanger:      '#ff3366',  // --accent-danger
    accentRed:         '#C90000',  // --accent-red (Auth + kritische Alerts)

    // Hintergrund-Basis
    bgPrimary:         '#0a0d14',  // --bg-primary
    bgSecondary:       '#060812',  // --bg-secondary
    bgMapDark:         '#0b0e17',  // --bg-map-dark

    // Text
    textPrimary:       '#f0f4f8',  // --text-primary
    textMuted:         '#94a3b8',  // --text-muted
    textOnAccent:      '#050a14',  // --text-on-accent
  },

  /** Semitransparente Tints (Glassmorphism) */
  tint: {
    cyan:    'rgba(0, 240, 255, 0.15)',   // --accent-cyan-subtle
    gold:    'rgba(255, 183, 0, 0.15)',   // --accent-gold-subtle
    green:   'rgba(0, 255, 102, 0.12)',   // --accent-green-subtle
    pink:    'rgba(255, 0, 127, 0.15)',   // --accent-pink-subtle
    danger:  'rgba(255, 51, 102, 0.15)',  // --accent-danger-subtle
  },

  /** Hintergrund-Schichten */
  surface: {
    overlay:    'rgba(5, 8, 17, 0.82)',    // --bg-overlay
    subtle:     'rgba(5, 10, 20, 0.65)',   // --bg-surface-subtle
    medium:     'rgba(5, 10, 20, 0.80)',   // --bg-surface-medium
    input:      'rgba(5, 10, 20, 0.85)',   // --bg-input
    elevated:   'rgba(5, 10, 20, 0.96)',   // --bg-surface-elevated
    glassPanel: 'rgba(10, 18, 30, 0.95)', // --bg-glass-panel
    toast:      'rgba(10, 20, 35, 0.94)', // --bg-toast
    floating:   'rgba(15, 23, 42, 0.92)', // --bg-floating-control
  },

  /** Typografie & Font-Familien */
  font: {
    chakra:    "'Chakra Petch', monospace",              // Hero, Brand-Titel, Manöver-Straßen
    jetbrains: "'JetBrains Mono', monospace",            // Telemetrie, Zahlen, HUD-Labels, Units
    inter:     "'Inter', system-ui, sans-serif",         // Fließtext, Menüs, Inputs
  },

  /** Typografische Skala */
  fontSize: {
    micro:      '8px',    // Micro-Labels, Kategorie-Chips
    unit:       '9px',    // Telemetrie-Units, Status-Bar
    label:      '10px',   // HUD-Labels, Chip-Beschriftung
    caption:    '11px',   // Sekundär-Info, kleine Buttons
    bodySm:     '12px',   // Sub-Beschriftungen
    body:       '13px',   // Standard-UI-Text
    subheading: '15px',   // Karten-Titel, mittlere Headlines
    heading:    '18px',   // Sektions-Titel, große Werte
    title:      '22px',   // Manöver-Straße, Hero-Werte
    hero:       '28px',   // Brand-Titel, Haupt-Hero
    display:    '36px',   // Distanz-Hero, Cockpit-Speed
  },

  /** Borders & Outlines */
  border: {
    whiteSubtle:  'rgba(255, 255, 255, 0.08)', // --border-white-subtle
    whiteMedium:  'rgba(255, 255, 255, 0.12)', // --border-white-medium
    whiteStrong:  'rgba(255, 255, 255, 0.20)', // --border-white-strong
    cyan:         'rgba(0, 229, 255, 0.25)',  // --border-cyan
    cyanHot:      'rgba(0, 229, 255, 0.45)',  // --border-cyan-hot
    gold:         'rgba(255, 183, 0, 0.35)',  // --border-gold
    goldHot:      'rgba(255, 183, 0, 0.55)',  // --border-gold-hot
    glass:        'rgba(0, 229, 255, 0.32)',  // --border-glass
  },

  /** Border-Radius System */
  radius: {
    xs:   '6px',
    sm:   '8px',
    md:   '12px',
    lg:   '16px',
    xl:   '20px',
    full: '9999px',
  },

  /** Abstände */
  spacing: {
    xs:  '4px',
    sm:  '8px',
    md:  '12px',
    lg:  '16px',
    xl:  '24px',
    xxl: '32px',
  },

  /** Z-Index Hierarchie */
  zIndex: {
    map:      0,
    hud:      1000,
    floating: 1000,
    card:     2200,
    modal:    2500,
    planner:  3000,
    toast:    3500,
  },

  /** CSS-Custom-Property Mapping (:root) */
  cssVars: {
    '--bg-primary':           '#0a0d14',
    '--bg-secondary':         '#060812',
    '--bg-card':              'rgba(6, 10, 22, 0.88)',
    '--accent-cyan':          '#00E5FF',
    '--accent-neon-green':    '#00ff66',
    '--accent-gold':          '#ffb700',
    '--accent-pink':          '#ff007f',
    '--accent-danger':        '#ff3366',
    '--accent-danger-subtle': 'rgba(255, 51, 102, 0.15)',
    '--accent-red':           '#C90000',
    '--text-primary':         '#f0f4f8',
    '--text-muted':           '#94a3b8',
    '--text-dim':             'rgba(148, 163, 184, 0.5)',
    '--border-glass':         'rgba(0, 229, 255, 0.32)',
    '--border-cyan':          'rgba(0, 229, 255, 0.25)',
    '--border-cyan-hot':      'rgba(0, 229, 255, 0.45)',
    '--border-gold':          'rgba(255, 183, 0, 0.35)',
    '--border-gold-hot':      'rgba(255, 183, 0, 0.55)',
    '--bg-overlay':           'rgba(5, 8, 17, 0.82)',
    '--bg-standby-shader':    'rgba(6, 12, 22, 0.72)',
    '--bg-surface-subtle':    'rgba(5, 10, 20, 0.65)',
    '--bg-surface-medium':    'rgba(5, 10, 20, 0.80)',
    '--bg-input':             'rgba(5, 10, 20, 0.85)',
    '--bg-surface-elevated':  'rgba(5, 10, 20, 0.96)',
    '--bg-glass-panel':       'rgba(10, 18, 30, 0.95)',
    '--bg-toast':             'rgba(10, 20, 35, 0.94)',
    '--bg-floating-control':  'rgba(15, 23, 42, 0.92)',
    '--bg-map-dark':          '#0b0e17',
    '--text-on-accent':       '#050a14',
    '--accent-cyan-subtle':   'rgba(0, 240, 255, 0.15)',
    '--accent-cyan-dark':     '#00a8e8',
    '--accent-gold-subtle':   'rgba(255, 183, 0, 0.15)',
    '--accent-green-subtle':  'rgba(0, 255, 102, 0.12)',
    '--accent-pink-subtle':   'rgba(255, 0, 127, 0.15)',
    '--border-white-subtle':  'rgba(255, 255, 255, 0.08)',
    '--border-white-medium':  'rgba(255, 255, 255, 0.12)',
    '--border-white-strong':  'rgba(255, 255, 255, 0.20)',
    '--text-secondary':       'rgba(255, 255, 255, 0.70)',
    '--radius-xs':            '6px',
    '--radius-sm':            '8px',
    '--radius-md':            '12px',
    '--radius-lg':            '16px',
    '--radius-xl':            '20px',
    '--radius-full':          '9999px',
    '--z-map':                '0',
    '--z-hud':                '1000',
    '--z-floating':           '1000',
    '--z-card':               '2200',
    '--z-modal':              '2500',
    '--z-planner':            '3000',
    '--z-toast':              '3500',
  } as const,
} as const;

export type DesignTokens = typeof designTokens;
