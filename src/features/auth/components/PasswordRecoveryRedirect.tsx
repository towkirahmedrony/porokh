import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { supabase } from '@/shared/lib/supabase';
import {
  PASSWORD_RECOVERY_REDIRECT_PATH,
  PASSWORD_RECOVERY_ROUTE_PATH,
  readPasswordRecoveryErrorFromUrl,
  type PasswordRecoveryErrorKind,
} from '../utils/passwordRecovery';
import { hasRecentPasswordRecoverySession } from '../utils/passwordRecoverySession';

function hasTaggedRecoveryCode(): boolean {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  const hasCode = Boolean(query.get('code') || hash.get('code'));
  const taggedRecovery = [query, hash].some(
    (params) =>
      params.get('type') === 'recovery' || params.get('mode') === 'recovery'
  );

  return hasCode && taggedRecovery;
}

/**
 * A Supabase recovery link lands on whatever URL the Auth "Redirect URLs"
 * allow-list accepts. If that URL is not the reset screen (for example the
 * project Site URL), the SDK still establishes a recovery session but the user
 * would otherwise be dropped on the homepage with no way to set a password.
 *
 * This component watches for the SDK's verified `PASSWORD_RECOVERY` event (and
 * the short-lived marker it leaves behind) and moves the user to the reset
 * route, which is where the new-password form lives.
 */
export function PasswordRecoveryRedirect() {
  const navigate = useNavigate();
  const handledRef = useRef(false);

  useEffect(() => {
    let active = true;

    const goToReset = (reason?: PasswordRecoveryErrorKind) => {
      if (!active || handledRef.current) return;
      if (window.location.pathname === PASSWORD_RECOVERY_ROUTE_PATH) return;

      handledRef.current = true;
      const target = reason
        ? `${PASSWORD_RECOVERY_REDIRECT_PATH}&reason=${reason}`
        : PASSWORD_RECOVERY_REDIRECT_PATH;

      navigate(target, { replace: true });
    };

    const urlError = readPasswordRecoveryErrorFromUrl({
      search: window.location.search,
      hash: window.location.hash,
    });

    if (urlError) {
      goToReset(urlError);
      return () => {
        active = false;
      };
    }

    // Explicitly tagged recovery callback (PKCE-style `?code=` links). The plain
    // OAuth callback also uses `code`, so the recovery marker must be present.
    if (hasTaggedRecoveryCode()) {
      goToReset();
      return () => {
        active = false;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        goToReset();
      }
    });

    // The SDK may have consumed the link (and emitted its event) before React
    // mounted this component. The verified marker covers that ordering.
    void supabase.auth.getSession().then(({ data }) => {
      if (hasRecentPasswordRecoverySession(data.session)) {
        goToReset();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  return null;
}

export default PasswordRecoveryRedirect;
