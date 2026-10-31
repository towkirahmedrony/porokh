import React, { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';

// Hooks & Services
import { useAuth } from '@/features/auth/hooks/useAuth';
import { requestNotificationPermission, listenForForegroundMessages } from '@/features/notifications/services/notificationService';

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

const App: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id; // Extracting primitive value for stable dependency

  useEffect(() => {
    // Listen for in-app notifications while app is open
    const unsubscribe = listenForForegroundMessages();

    // Request permission if user is logged in
    if (userId) {
      requestNotificationPermission();
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [userId]); 

  return (
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
            {/* Runs above the guard so a recovery link is honoured even while the
                maintenance check is still resolving. */}
            <PasswordRecoveryRedirect />
            <NativeAuthCallback />
            <SystemGuard>
              <AppRoutes />
            </SystemGuard>
          </PaywallProvider>
          <UpdateBanner />
        </UpdateProvider>
      </LanguageProvider>
    </>
  );
};

export default App;
