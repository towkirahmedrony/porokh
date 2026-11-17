import React from 'react';
import { Toaster } from 'react-hot-toast';

// Components & Providers
import { NativePushProvider } from '@/features/notifications/native/NativePushProvider';

// Layout & Guards
import { SystemGuard } from '@/shared/components/layout/SystemGuard';
import { LanguageProvider } from '@/shared/i18n/LanguageProvider';
import { PaywallProvider } from '@/features/access/context/PaywallProvider';
import { PasswordRecoveryRedirect } from '@/features/auth/components/PasswordRecoveryRedirect';
import { NativeAuthCallback } from '@/features/auth/components/NativeAuthCallback';
import { UpdateProvider } from '@/features/app-update/UpdateProvider';
import { UpdateBanner } from '@/features/app-update/UpdateBanner';
import { AndroidBackButton } from '@/app/navigation/AndroidBackButton';

// Routes
import AppRoutes from '@/app/routes/AppRoutes';

const App: React.FC = () => (
  <>
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          backgroundColor: 'var(--dyn-card, #ffffff)',
          color: 'var(--dyn-text, #000000)',
          border: '1px solid color-mix(in srgb, var(--dyn-text, #000000) 10%, transparent)',
        },
      }}
    />
    <LanguageProvider>
      {/* Single owner of Android hardware/gesture Back for the whole app. */}
      <AndroidBackButton />
      <UpdateProvider>
        <PaywallProvider>
          {/* Native push lives above the routes so a tap from a cold start can
              navigate once the router is ready. */}
          <NativePushProvider>
            {/* Runs above the guard so a recovery link is honoured even while the
                maintenance check is still resolving. */}
            <PasswordRecoveryRedirect />
            <NativeAuthCallback />
            <SystemGuard>
              <AppRoutes />
            </SystemGuard>
          </NativePushProvider>
        </PaywallProvider>
        <UpdateBanner />
      </UpdateProvider>
    </LanguageProvider>
  </>
);

export default App;
