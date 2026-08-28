# Der Wegweiser — Workspace Rules & Guidelines

- **Project**: Der Wegweiser (Intelligente E-Bike Navigation & Community Co-Pilot)
- **Tech Stack**: React 19, TypeScript, Vite 8, Tailwind/Cyberpunk CSS, Leaflet/React-Leaflet, Capacitor (Android APK), Web-Bluetooth BLE, Firebase & Google Cloud Platform (GCP).
- **Backend & Cloud**:
  - GCP / Firebase Project: `der-wegweiser` (Location: `europe-west3`, App ID: `1:430891513864:web:6e7dedec657640a139f9bd`)
  - AI Assistant: Hybrid Co-Pilot (In-App Gemini 2.0 Flash via Firebase AI Logic / Vertex AI Proxy via `vertex_proxy.py`)
- **Coding Conventions**:
  - All user-facing UI strings must be in German (Deutsch).
  - TypeScript strict typing (no `any` where avoidable).
  - Follow the cyberpunk glassmorphism design system.
  - Test builds with `npm run build` and linting with `npm run lint`.
