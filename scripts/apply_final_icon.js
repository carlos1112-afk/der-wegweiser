import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const MASTER_ICON = '/home/carlos/.gemini/antigravity/brain/a6e8cbd3-e5c6-4872-a756-ad3e5b62a914/icon_blue_red_a_1787948225505.jpg';
const STORE_DIR = path.resolve('assets/store');
const IOS_ASSETS_DIR = path.resolve('ios/App/App/Assets.xcassets');
const ANDROID_RES_DIR = path.resolve('android/app/src/main/res');

fs.mkdirSync(STORE_DIR, { recursive: true });
fs.mkdirSync(path.join(IOS_ASSETS_DIR, 'AppIcon.appiconset'), { recursive: true });
fs.mkdirSync(path.join(IOS_ASSETS_DIR, 'Splash.imageset'), { recursive: true });
fs.mkdirSync(path.join(ANDROID_RES_DIR, 'drawable'), { recursive: true });
fs.mkdirSync(path.join(ANDROID_RES_DIR, 'mipmap-anydpi-v26'), { recursive: true });

console.log('🚀 Applying final Blue/Red Hybrid Icon from:', MASTER_ICON);

// 1. iOS App Store Icon (1024x1024)
const iosIcon = path.join(IOS_ASSETS_DIR, 'AppIcon.appiconset/AppIcon-512@2x.png');
execSync(`magick "${MASTER_ICON}" -resize 1024x1024 "${iosIcon}"`);
console.log('✓ iOS AppIcon 1024x1024 generated');

// 2. Play Store & Web Icons
const playStoreIcon = path.join(STORE_DIR, 'play_store_512.png');
const pwa512 = path.resolve('public/icon-512.png');
const pwa192 = path.resolve('public/icon-192.png');
const favicon = path.resolve('public/favicon.png');

execSync(`magick "${MASTER_ICON}" -resize 512x512 "${playStoreIcon}"`);
execSync(`magick "${MASTER_ICON}" -resize 512x512 "${pwa512}"`);
execSync(`magick "${MASTER_ICON}" -resize 192x192 "${pwa192}"`);
execSync(`magick "${MASTER_ICON}" -resize 64x64 "${favicon}"`);
console.log('✓ Play Store 512px and Web PWA icons generated');

// 3. Android Mipmap Densities
const mipmaps = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

mipmaps.forEach(({ folder, size }) => {
  const dir = path.join(ANDROID_RES_DIR, folder);
  fs.mkdirSync(dir, { recursive: true });
  execSync(`magick "${MASTER_ICON}" -resize ${size}x${size} "${path.join(dir, 'ic_launcher.png')}"`);
  execSync(`magick "${MASTER_ICON}" -resize ${size}x${size} "${path.join(dir, 'ic_launcher_round.png')}"`);
});
console.log('✓ Android Mipmap icons generated (mdpi -> xxxhdpi)');

// 4. Android Adaptive Foreground
const fgPng = path.join(ANDROID_RES_DIR, 'drawable/ic_launcher_foreground.png');
execSync(`magick "${MASTER_ICON}" -resize 300x300 -gravity center -extent 432x432 "${fgPng}"`);
console.log('✓ Android Adaptive foreground generated');

// 5. iOS Splash Screen Asset
const iosSplash1 = path.join(IOS_ASSETS_DIR, 'Splash.imageset/splash-2732x2732.png');
const iosSplash2 = path.join(IOS_ASSETS_DIR, 'Splash.imageset/splash-2732x2732-1.png');
const iosSplash3 = path.join(IOS_ASSETS_DIR, 'Splash.imageset/splash-2732x2732-2.png');

// Create a dark 2732x2732 launch splash with the centered glowing logo
execSync(`magick -size 2732x2732 "radial-gradient:#0c1a2e-#050a14" \\( "${MASTER_ICON}" -resize 800x800 \\) -gravity center -composite "${iosSplash1}"`);
fs.copyFileSync(iosSplash1, iosSplash2);
fs.copyFileSync(iosSplash1, iosSplash3);
console.log('✓ iOS Launch Screen Splash assets (2732x2732) generated');

// 6. Update Feature Graphic with the new Icon
const featureGraphicPngPath = path.join(STORE_DIR, 'feature_graphic_1024x500.png');
execSync(`magick -size 1024x500 "radial-gradient:#0e233d-#050a14" \\( "${MASTER_ICON}" -resize 360x360 \\) -gravity east -geometry +60+0 -composite "${featureGraphicPngPath}"`);
console.log('✓ Google Play Feature Graphic updated with new icon');

console.log('🎉 ALL FINAL APP ICONS & SPLASH ASSETS SUCCESSFULLY APPLIED!');
