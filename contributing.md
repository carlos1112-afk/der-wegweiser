# Contributing to Der Wegweiser

Thank you for your interest in contributing to **Der Wegweiser** – the next-generation AI-powered E-Bike Navigation, Telemetry & Charging platform.

## Getting Started

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/<your-username>/der-wegweiser.git
   cd der-wegweiser
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Copy `.env.example` to `.env.local` and add your API keys:
   ```bash
   cp .env.example .env.local
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

## Development Guidelines

- **TypeScript**: Ensure strict type safety and run `npm run build` before submitting PRs.
- **Linting**: Keep code clean using `npm run lint`.
- **Modularity**: Place reusable UI components into `src/components/` and business logic/services into `src/services/`.

## Submitting Pull Requests

1. Create a feature branch: `git checkout -b feature/my-new-feature`
2. Commit your changes: `git commit -m "feat: Add new awesome feature"`
3. Push to your fork: `git push origin feature/my-new-feature`
4. Open a Pull Request with a clear summary of your changes.
