import './splash/appSplash';
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('chunk-reloaded')) {
    sessionStorage.setItem('chunk-reloaded', '1');
    window.location.reload();
  }
});

import './debug/vconsole';
import React, { ErrorInfo } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import App from './App';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import {
  queryClient,
  localStoragePersister,
  PERSISTED_CACHE_MAX_AGE_MS,
} from '@/shared/lib/queryClient';
import { APP_MESSAGES } from '@/shared/i18n/messages';
import { readStoredLanguage, resolveInitialLanguage } from '@/shared/i18n/languagePreference';

import './index.css';

// Enable VConsole only during development.
// This allows inspecting JavaScript errors directly from a mobile browser.
// Loaded lazily so the debug console never enters the startup bundle.
if (import.meta.env.DEV) {
  void import('vconsole').then(({ default: VConsole }) => {
    new VConsole({ theme: 'light' });
    console.info('[Debug] VConsole initialized.');
  });
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(
    _error: Error
  ): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught React error:', error, errorInfo);
  }

  render() {
    // The error boundary mounts outside the language provider, so it reads the
    // persisted choice directly from the shared language preference store.
    const messages = APP_MESSAGES[resolveInitialLanguage(readStoredLanguage())];
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--dyn-bg, #f8fafc)',
            color: 'var(--dyn-text, #0f172a)',
          }}
        >
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                marginBottom: '1rem',
                color: 'var(--dyn-primary, #3b82f6)',
              }}
            >
              {messages['error.boundaryTitle']}
            </h1>

            <p style={{ opacity: 0.8 }}>
              {messages['error.boundaryBody']}
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                marginTop: '1rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: 'var(--dyn-primary, #3b82f6)',
                color: '#ffffff',
                borderRadius: '0.5rem',
                fontWeight: 'bold',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {messages['error.reload']}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: localStoragePersister,
          maxAge: PERSISTED_CACHE_MAX_AGE_MS,
        }}
      >
        <BrowserRouter
          future={{
            v7_relativeSplatPath: true,
            v7_startTransition: true,
          }}
        >
          <AuthProvider>
            <ThemeProvider>
              <App />
            </ThemeProvider>
          </AuthProvider>
        </BrowserRouter>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
