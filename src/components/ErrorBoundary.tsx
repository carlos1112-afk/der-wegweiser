import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Unhandled error captured:', error, errorInfo);
  }

  public handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: '#050a14',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            zIndex: 9999,
            textAlign: 'center',
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '480px',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid rgba(255, 60, 60, 0.4)',
              boxShadow: '0 0 30px rgba(255, 60, 60, 0.2)',
            }}
          >
            <AlertTriangle size={48} color="#ff4444" style={{ margin: '0 auto 16px auto' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '8px', color: '#ff6666' }}>
              Dienst vorübergehend nicht verfügbar
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#8a99ad', marginBottom: '16px', lineHeight: 1.5 }}>
              Ein externer Dienst (z. B. Routing, Wetter oder Karte) ist offline oder hat keine Daten geliefert.
            </p>
            {this.state.error && (
              <pre
                style={{
                  fontSize: '0.75rem',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  color: '#ff8888',
                  overflowX: 'auto',
                  textAlign: 'left',
                  marginBottom: '16px',
                }}
              >
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="btn-cyberpunk btn-cyan"
              style={{ padding: '10px 18px', margin: '0 auto', fontSize: '0.85rem' }}
            >
              <RefreshCw size={16} /> App neu laden
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
