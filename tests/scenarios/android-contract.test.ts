import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.resolve(p), 'utf8');

describe('Szenario 1: Android-Umgebungsvertrag (echte Dateien)', () => {
  const manifestPath = 'android/app/src/main/AndroidManifest.xml';
  const gradlePath = 'android/app/build.gradle';
  const netSecPath = 'android/app/src/main/res/xml/network_security_config.xml';

  it('Android-Konfigurationsdateien existieren', () => {
    expect(fs.existsSync(path.resolve(manifestPath))).toBe(true);
    expect(fs.existsSync(path.resolve(gradlePath))).toBe(true);
    expect(fs.existsSync(path.resolve(netSecPath))).toBe(true);
  });

  const manifest = read(manifestPath);
  const gradle = read(gradlePath);
  const netSec = read(netSecPath);

  it('Application-ID ist app.derwegweiser.navi', () => {
    expect(
      manifest.includes('package="app.derwegweiser.navi"') || gradle.includes('applicationId "app.derwegweiser.navi"'),
    ).toBe(true);
  });

  it('Backup und Klartext-Verkehr sind deaktiviert', () => {
    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain('android:usesCleartextTraffic="false"');
    expect(netSec).toContain('cleartextTrafficPermitted="false"');
  });

  it('Standort: Foreground-Service-Berechtigung ja, Hintergrund-Tracking nein', () => {
    expect(manifest).toContain('FOREGROUND_SERVICE_LOCATION');
    expect(manifest).not.toContain('ACCESS_BACKGROUND_LOCATION');
  });
});

describe('Szenario 1b: Quelltext-Verträge (Textprüfung, kein Laufzeitbeweis)', () => {
  const auth = read('src/services/authService.ts');
  const css = read('src/index.css');
  const app = read('src/App.tsx');

  it('GitHub-OAuth entfernt, Consumer-OAuth konfiguriert', () => {
    expect(auth).not.toContain('signInWithGithub');
    for (const provider of ['microsoft.com', 'facebook.com', 'twitter.com', 'telegram.org']) {
      expect(auth).toContain(provider);
    }
  });

  it('3D-Billboarding-CSS und Navigations-HUD-Marker sind vorhanden', () => {
    expect(css).toContain('rotateX(-55deg) translateZ');
    expect(app).toContain('top-header-hud');
  });

  it('Push-zum-E-Bike-Button hat 3-Minuten-Auto-Ausblenden', () => {
    expect(app).toContain('isPushDismissed');
    expect(app).toContain('180000');
  });
});
