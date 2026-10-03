import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Silence console.error to avoid noise in the test output when we intentionally throw errors
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children without an error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child-component">Child Component</div>
      </ErrorBoundary>
    );

    expect(screen.getByTestId('child-component')).toBeInTheDocument();
  });

  it('catches rendering errors and renders the fallback UI', () => {
    const ProblemChild = () => {
      throw new Error('Test rendering error');
    };

    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );

    // Assert that the fallback UI is rendered
    expect(screen.getByText('Dienst vorübergehend nicht verfügbar')).toBeInTheDocument();
    expect(screen.getByText('Ein externer Dienst (z. B. Routing, Wetter oder Karte) ist offline oder hat keine Daten geliefert.')).toBeInTheDocument();
    expect(screen.getByText('Test rendering error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /app neu laden/i })).toBeInTheDocument();
  });
});
