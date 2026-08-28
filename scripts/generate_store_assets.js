import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const STORE_DIR = path.resolve('assets/store');
const IOS_ASSETS_DIR = path.resolve('ios/App/App/Assets.xcassets');
const ANDROID_RES_DIR = path.resolve('android/app/src/main/res');

// Ensure output directories exist
fs.mkdirSync(STORE_DIR, { recursive: true });
fs.mkdirSync(path.join(IOS_ASSETS_DIR, 'AppIcon.appiconset'), { recursive: true });
fs.mkdirSync(path.join(IOS_ASSETS_DIR, 'Splash.imageset'), { recursive: true });
fs.mkdirSync(path.join(ANDROID_RES_DIR, 'drawable'), { recursive: true });
fs.mkdirSync(path.join(ANDROID_RES_DIR, 'mipmap-anydpi-v26'), { recursive: true });

// 1. Master Icon SVG (1024x1024)
const masterIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#0c1a2e"/>
      <stop offset="60%" stop-color="#050a14"/>
      <stop offset="100%" stop-color="#02050a"/>
    </radialGradient>

    <filter id="cyanGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="28" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <filter id="goldGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="20" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <linearGradient id="arrowCyanLight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="30%" stop-color="#00f0ff"/>
      <stop offset="100%" stop-color="#00a3cc"/>
    </linearGradient>

    <linearGradient id="arrowCyanDark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#009bb3"/>
      <stop offset="100%" stop-color="#004d66"/>
    </linearGradient>

    <linearGradient id="goldBoltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff275"/>
      <stop offset="60%" stop-color="#ffb700"/>
      <stop offset="100%" stop-color="#ff8800"/>
    </linearGradient>
  </defs>

  <rect width="1024" height="1024" fill="url(#bgGrad)"/>

  <circle cx="512" cy="512" r="410" fill="none" stroke="#00f0ff" stroke-width="6" stroke-opacity="0.25"/>
  <circle cx="512" cy="512" r="380" fill="none" stroke="#00f0ff" stroke-width="12" stroke-opacity="0.8" stroke-dasharray="14 18" filter="url(#cyanGlow)"/>
  <circle cx="512" cy="512" r="350" fill="none" stroke="#00f0ff" stroke-width="3" stroke-opacity="0.4"/>

  <line x1="512" y1="90" x2="512" y2="150" stroke="#00f0ff" stroke-width="10" stroke-linecap="round" filter="url(#cyanGlow)"/>
  <line x1="512" y1="874" x2="512" y2="934" stroke="#00f0ff" stroke-width="10" stroke-linecap="round" stroke-opacity="0.6"/>
  <line x1="90" y1="512" x2="150" y2="512" stroke="#00f0ff" stroke-width="10" stroke-linecap="round" stroke-opacity="0.6"/>
  <line x1="874" y1="512" x2="934" y2="512" stroke="#00f0ff" stroke-width="10" stroke-linecap="round" stroke-opacity="0.6"/>

  <g transform="translate(512, 512) rotate(45) translate(-512, -512)" filter="url(#cyanGlow)">
    <polygon points="512,180 512,512 660,512" fill="url(#arrowCyanLight)"/>
    <polygon points="512,180 364,512 512,512" fill="url(#arrowCyanDark)"/>
    <polygon points="364,512 512,512 512,680" fill="url(#arrowCyanDark)" opacity="0.85"/>
    <polygon points="512,512 660,512 512,680" fill="url(#arrowCyanLight)" opacity="0.85"/>
  </g>

  <g filter="url(#goldGlow)">
    <polygon points="522,380 472,500 522,500 492,640 562,490 512,490" fill="url(#goldBoltGrad)"/>
  </g>

  <circle cx="512" cy="512" r="24" fill="#ffffff" filter="url(#cyanGlow)"/>
  <circle cx="512" cy="512" r="14" fill="#00f0ff"/>
</svg>
`;

// Save Master SVG
const masterSvgPath = path.join(STORE_DIR, 'master_icon.svg');
fs.writeFileSync(masterSvgPath, masterIconSvg.trim());
console.log('✓ Master SVG Icon written:', masterSvgPath);

// 2. Render App Store & Google Play Master Icons
const ios1024Png = path.join(IOS_ASSETS_DIR, 'AppIcon.appiconset/AppIcon-512@2x.png');
const playStore512Png = path.join(STORE_DIR, 'play_store_512.png');
const pwa512Png = path.resolve('public/icon-512.png');
const pwa192Png = path.resolve('public/icon-192.png');

execSync(`magick -background none -density 300 "${masterSvgPath}" -resize 1024x1024 "${ios1024Png}"`);
execSync(`magick -background none -density 300 "${masterSvgPath}" -resize 512x512 "${playStore512Png}"`);
execSync(`magick -background none -density 300 "${masterSvgPath}" -resize 512x512 "${pwa512Png}"`);
execSync(`magick -background none -density 300 "${masterSvgPath}" -resize 192x192 "${pwa192Png}"`);
console.log('✓ Rendered iOS 1024px & Play Store 512px PNGs');

// 3. Android Mipmap Density Icons
const mipmapConfigs = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

mipmapConfigs.forEach(({ folder, size }) => {
  const dir = path.join(ANDROID_RES_DIR, folder);
  fs.mkdirSync(dir, { recursive: true });
  execSync(`magick -background none -density 300 "${masterSvgPath}" -resize ${size}x${size} "${path.join(dir, 'ic_launcher.png')}"`);
  execSync(`magick -background none -density 300 "${masterSvgPath}" -resize ${size}x${size} "${path.join(dir, 'ic_launcher_round.png')}"`);
});
console.log('✓ Rendered Android Mipmap Icons (mdpi -> xxxhdpi)');

// 4. Android Adaptive Vector Icon (mipmap-anydpi-v26)
const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>`;
fs.writeFileSync(path.join(ANDROID_RES_DIR, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptiveIconXml);
fs.writeFileSync(path.join(ANDROID_RES_DIR, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptiveIconXml);

const bgDrawableXml = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <gradient
        android:startColor="#0c1a2e"
        android:centerColor="#050a14"
        android:endColor="#02050a"
        android:type="radial"
        android:gradientRadius="70%p" />
</shape>`;
fs.writeFileSync(path.join(ANDROID_RES_DIR, 'drawable/ic_launcher_background.xml'), bgDrawableXml);

// Foreground PNG for Adaptive Icon (432x432)
const fgPng = path.join(ANDROID_RES_DIR, 'drawable/ic_launcher_foreground.png');
execSync(`magick -background none -density 300 "${masterSvgPath}" -resize 300x300 -gravity center -extent 432x432 "${fgPng}"`);
console.log('✓ Configured Android Adaptive Icons XML & Foreground');

// 5. Google Play Feature Graphic (1024x500 px)
const featureGraphicSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 500" width="1024" height="500">
  <defs>
    <radialGradient id="fgBg" cx="65%" cy="50%" r="80%">
      <stop offset="0%" stop-color="#0e233d"/>
      <stop offset="50%" stop-color="#050a14"/>
      <stop offset="100%" stop-color="#02050a"/>
    </radialGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect width="1024" height="500" fill="url(#fgBg)"/>

  <path d="M0,420 L1024,420 M0,450 L1024,450 M0,475 L1024,475" stroke="#00f0ff" stroke-width="1.5" stroke-opacity="0.2"/>
  <path d="M150,500 L250,380 M350,500 L400,380 M750,500 L680,380 M880,500 L800,380" stroke="#00f0ff" stroke-width="1.5" stroke-opacity="0.2"/>

  <g transform="translate(60, 160)">
    <text x="0" y="0" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="52" fill="#00f0ff" letter-spacing="2" filter="url(#glow)">
      DER WEGWEISER
    </text>
    <text x="0" y="55" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="24" fill="#ffffff" letter-spacing="1">
      Autonomous E-Bike Navigation &amp; Co-Pilot
    </text>
    <text x="0" y="105" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="16" fill="#94a3b8">
      ⚡ Bosch &amp; Shimano Telemetrie • KI Heute-Tour • Charge &apos;n&apos; Earn
    </text>
  </g>

  <g transform="translate(750, 250) scale(0.65) translate(-512, -512)">
    ${masterIconSvg.replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">', '').replace('</svg>', '')}
  </g>
</svg>
`;

const featureGraphicSvgPath = path.join(STORE_DIR, 'feature_graphic.svg');
const featureGraphicPngPath = path.join(STORE_DIR, 'feature_graphic_1024x500.png');
fs.writeFileSync(featureGraphicSvgPath, featureGraphicSvg.trim());
execSync(`magick -background none -density 300 "${featureGraphicSvgPath}" -resize 1024x500 "${featureGraphicPngPath}"`);
console.log('✓ Generated Google Play Feature Graphic (1024x500 px):', featureGraphicPngPath);

// 6. Marketing Store Screenshots (1290x2796 px)
const screenshotTemplates = [
  {
    fileName: 'screenshot_1_anticipation.png',
    title: 'KI-HEUTE-TOUR',
    sub: 'Deine perfekte E-Bike Tour mit 0 Klicks antizipiert',
    pill: '✨ ZERO-CLICK NAVIGATION',
    color: '#00f0ff',
  },
  {
    fileName: 'screenshot_2_cockpit.png',
    title: '3D CYBERPUNK COCKPIT',
    sub: 'Live-Höhenprofil, Steigungswarnungen &amp; Audio-Guidance',
    pill: '🗺️ LIVE 3D HEADS-UP DISPLAY',
    color: '#00f0ff',
  },
  {
    fileName: 'screenshot_3_telemetry.png',
    title: 'BOSCH &amp; SHIMANO LIVE',
    sub: 'Echtzeit-Telemetrie: Watt, Trittfrequenz, Motor &amp; SoC %',
    pill: '⚡ BLUETOOTH SMART SYSTEM',
    color: '#00ff66',
  },
  {
    fileName: 'screenshot_4_rewards.png',
    title: 'CHARGE &apos;N&apos; EARN',
    sub: 'Verdiene Tokens &amp; Prämien während deiner Ladepausen',
    pill: '🪙 TOKEN LOUNGE &amp; GAMES',
    color: '#ffb700',
  },
  {
    fileName: 'screenshot_5_offline.png',
    title: '100 % OFFLINE-KARTEN',
    sub: 'Zuverlässige Navigation &amp; GPX-Aufzeichnung im Funkloch',
    pill: '🌲 KEIN INTERNET ERFORDERLICH',
    color: '#00f0ff',
  },
];

screenshotTemplates.forEach(({ fileName, title, sub, pill, color }, index) => {
  const ssSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1290 2796" width="1290" height="2796">
  <defs>
    <radialGradient id="ssBg${index}" cx="50%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#0e233d"/>
      <stop offset="50%" stop-color="#050a14"/>
      <stop offset="100%" stop-color="#02050a"/>
    </radialGradient>
    <filter id="ssGlow${index}" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="20" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1290" height="2796" fill="url(#ssBg${index})"/>

  <!-- Top Marketing Banner -->
  <g transform="translate(100, 240)">
    <!-- Pill Badge -->
    <rect x="0" y="0" width="460" height="60" rx="30" fill="rgba(0, 240, 255, 0.15)" stroke="${color}" stroke-width="2"/>
    <text x="30" y="40" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" font-size="22" fill="${color}" letter-spacing="1.5">
      ${pill}
    </text>

    <!-- Main Title -->
    <text x="0" y="160" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="64" fill="#ffffff" letter-spacing="1" filter="url(#ssGlow${index})">
      ${title}
    </text>

    <!-- Subtitle -->
    <text x="0" y="235" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="32" fill="#94a3b8">
      ${sub}
    </text>
  </g>

  <!-- Smartphone Mockup Frame -->
  <g transform="translate(130, 680)">
    <!-- Phone Bezel & Shadow -->
    <rect x="-10" y="-10" width="1050" height="1950" rx="90" fill="#000000" stroke="#1e293b" stroke-width="8" filter="url(#ssGlow${index})"/>
    <rect x="0" y="0" width="1030" height="1930" rx="80" fill="#0a1220" stroke="${color}" stroke-width="4" stroke-opacity="0.6"/>

    <!-- Dynamic Island Pill -->
    <rect x="390" y="30" width="250" height="55" rx="27" fill="#000000"/>

    <!-- Inside Phone UI Graphic Simulation -->
    <g transform="translate(40, 120)">
      <!-- App Header -->
      <rect x="0" y="0" width="950" height="80" rx="20" fill="rgba(15, 23, 42, 0.8)" stroke="#00f0ff" stroke-width="1.5"/>
      <text x="40" y="50" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" font-size="28" fill="#00f0ff">
        DER WEGWEISER
      </text>
      <text x="750" y="50" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" font-size="26" fill="#ffb700">
        🪙 60 Tok.
      </text>

      <!-- Center Feature Visualization Card -->
      <rect x="0" y="110" width="950" height="1420" rx="30" fill="rgba(10, 18, 32, 0.9)" stroke="rgba(0, 240, 255, 0.3)" stroke-width="2"/>
      
      <!-- Big Center Icon Badge -->
      <g transform="translate(475, 500) scale(0.7) translate(-512, -512)">
        ${masterIconSvg.replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">', '').replace('</svg>', '')}
      </g>

      <!-- Bottom Card Detail -->
      <rect x="40" y="1180" width="870" height="200" rx="24" fill="rgba(0, 240, 255, 0.12)" stroke="${color}" stroke-width="2"/>
      <text x="80" y="1260" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" font-size="36" fill="#ffffff">
        ${title}
      </text>
      <text x="80" y="1320" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="24" fill="${color}">
        Aktiviert • Echtzeit E-Bike Navigation
      </text>
    </g>
  </g>
</svg>
`;

  const ssSvgPath = path.join(STORE_DIR, `temp_${fileName}.svg`);
  const ssPngPath = path.join(STORE_DIR, fileName);
  fs.writeFileSync(ssSvgPath, ssSvg.trim());
  execSync(`magick -background none -density 300 "${ssSvgPath}" -resize 1290x2796 "${ssPngPath}"`);
  fs.unlinkSync(ssSvgPath);
  console.log(`✓ Rendered Screenshot ${index + 1}/5: ${fileName}`);
});

console.log('🎉 ALL STORE & PLATFORM ASSETS SUCCESSFULLY GENERATED!');
