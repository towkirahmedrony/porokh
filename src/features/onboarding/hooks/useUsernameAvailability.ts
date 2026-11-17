import { useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase';
import {
  isValidUsername,
  normalizeUsername,
} from '@/features/auth/utils/username';

export type UsernameAvailabilityStatus =
  | 'idle'
  | 'invalid'
  | 'checking'
  | 'available'
  | 'taken'
  | 'error';

export type UsernameAvailability = {
  status: UsernameAvailabilityStatus;
  value: string;
};

const DEBOUNCE_MS = 400;

export function useUsernameAvailability(
  username: string,
  enabled = true,
  currentUsername?: string | null
): UsernameAvailability {
  const normalized = normalizeUsername(username);
  const ownUsername = normalizeUsername(currentUsername ?? '');
  const [availability, setAvailability] = useState<UsernameAvailability>({
    status: 'idle',
    value: '',
  });

  useEffect(() => {
    if (!enabled) return;

    if (!normalized) {
      setAvailability({ status: 'idle', value: '' });
      return;
    }

    if (!isValidUsername(normalized)) {
      setAvailability({ status: 'invalid', value: normalized });
      return;
    }

    // Keeping an existing username is always allowed; the RPC would otherwise
    // report the user's own row as taken.
    if (ownUsername && normalized === ownUsername) {
      setAvailability({ status: 'available', value: normalized });
      return;
    }

    let cancelled = false;
    setAvailability({ status: 'checking', value: normalized });

    const timer = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc('is_username_available', {
          p_username: normalized,
        });

        if (cancelled) return;
        if (error) {
          setAvailability({ status: 'error', value: normalized });
          return;
        }

        setAvailability({
          status: data ? 'available' : 'taken',
          value: normalized,
        });
      } catch {
        if (!cancelled) {
          setAvailability({ status: 'error', value: normalized });
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, normalized, ownUsername]);

  return availability;
}
