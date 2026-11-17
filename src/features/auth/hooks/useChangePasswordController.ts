import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { supabase } from "@/shared/lib/supabase";
import {
  clearPasswordRecoverySession,
  hasPasswordRecoverySession,
} from "../utils/passwordRecoverySession";
import {
  PASSWORD_RECOVERY_ERROR_MESSAGES,
  normalizeRecoveryReason,
  readPasswordRecoveryErrorFromUrl,
} from "../utils/passwordRecovery";
import type { AppMessageKey } from "@/shared/i18n/messages";
import {
  clearRecoveryUrlTokens,
  DASHBOARD_HOME_PATH,
  MessageError,
  getRecoveryParams,
  getUpdatePasswordErrorMessage,
  LOGIN_PATH,
  type PasswordField,
  type PasswordVisibilityState,
  validatePasswordForm,
} from "../utils/changePasswordUtils";

const DEFAULT_VISIBLE_FIELDS: PasswordVisibilityState = {
  old: false,
  new: false,
  confirm: false,
};

export function useChangePasswordController() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [visibleFields, setVisibleFields] =
    useState<PasswordVisibilityState>(DEFAULT_VISIBLE_FIELDS);

  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState<AppMessageKey | null>(null);
  const [successMessage, setSuccessMessage] = useState<AppMessageKey | null>(null);

  const isSuccess = Boolean(successMessage);
  const errorId = error ? "change-password-error" : undefined;

  useEffect(() => {
    let isMounted = true;

    const initializeRecoverySession = async () => {
      const recoveryParams = getRecoveryParams(searchParams);
      const urlError =
        readPasswordRecoveryErrorFromUrl({
          search: window.location.search,
          hash: window.location.hash,
        }) ?? normalizeRecoveryReason(searchParams.get("reason"));

      try {
        let recoverySessionCreated = false;

        const {
          data: { session: initialSession },
          error: initialSessionError,
        } = await supabase.auth.getSession();

        if (initialSessionError) throw initialSessionError;

        // The SDK exchanges PKCE codes during client initialization and removes
        // `code` from the URL; a missing code with a recorded code means the SDK
        // already completed the exchange.
        const sdkConsumedCode = Boolean(
          recoveryParams.code &&
            !new URLSearchParams(window.location.search).has("code")
        );
        const alreadyValidated =
          hasPasswordRecoverySession(initialSession) || sdkConsumedCode;

        if (recoveryParams.code && !alreadyValidated) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            recoveryParams.code
          );

          if (exchangeError) {
            throw exchangeError;
          }
          recoverySessionCreated = true;
        } else if (
          recoveryParams.accessToken &&
          recoveryParams.refreshToken &&
          !alreadyValidated
        ) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: recoveryParams.accessToken,
            refresh_token: recoveryParams.refreshToken,
          });

          if (setSessionError) {
            throw setSessionError;
          }
          recoverySessionCreated = true;
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (sessionError) {
          throw sessionError;
        }

        // Supabase redirects failed links with an error instead of a session.
        if (urlError) {
          setIsRecoveryMode(true);
          setError(PASSWORD_RECOVERY_ERROR_MESSAGES[urlError]);
          clearRecoveryUrlTokens();
          return;
        }

        let recoveryAuthorized =
          recoverySessionCreated ||
          sdkConsumedCode ||
          hasPasswordRecoverySession(session);

        if (recoveryParams.isRecovery && session && !recoveryAuthorized) {
          // An implicit link is verified by the SDK asynchronously; the marker is
          // written from its PASSWORD_RECOVERY event. Give that event one turn.
          await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

          const {
            data: { session: latestSession },
          } = await supabase.auth.getSession();

          if (!isMounted) return;

          recoveryAuthorized = hasPasswordRecoverySession(latestSession ?? session);
        }

        if (session && recoveryAuthorized) {
          setIsRecoveryMode(true);
          setError(null);
          // The recovery session is established; keep tokens out of the address
          // bar so they cannot leak through history, screenshots or logs.
          clearRecoveryUrlTokens();
          return;
        }

        if (!session && recoveryParams.isRecovery) {
          setIsRecoveryMode(true);
          setError(PASSWORD_RECOVERY_ERROR_MESSAGES.expired);
          clearRecoveryUrlTokens();
          return;
        }

        if (!session) {
          navigate(LOGIN_PATH, {
            replace: true,
            state: {
              from: {
                pathname: window.location.pathname,
                search: window.location.search,
              },
            },
          });
          return;
        }

        // Signed-in visitor on the normal change-password screen.
        setIsRecoveryMode(false);
      } catch (sessionInitError: unknown) {
        if (!isMounted) return;

        setIsRecoveryMode(recoveryParams.isRecovery || urlError !== null);
        setError(getUpdatePasswordErrorMessage(sessionInitError));
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    };

    initializeRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
        setError(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, searchParams]);

  const toggleVisibility = (field: PasswordField) => {
    setVisibleFields((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const resetForm = () => {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setVisibleFields(DEFAULT_VISIBLE_FIELDS);
  };

  const clearErrorOnInput = () => {
    if (error) {
      setError(null);
    }
  };

  const verifyCurrentPassword = async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      throw new MessageError("auth.pw.userNotFound");
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword,
    });

    if (signInError) {
      throw new MessageError("auth.pw.wrongCurrentPassword");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading || isSuccess) return;

    setError(null);
    setSuccessMessage(null);

    const validationError = validatePasswordForm({
      isRecoveryMode,
      oldPassword,
      newPassword,
      confirmPassword,
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      if (!isRecoveryMode) {
        await verifyCurrentPassword();
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("No active session found for password update.");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      clearPasswordRecoverySession();
      resetForm();
      clearRecoveryUrlTokens();

      setSuccessMessage(
        isRecoveryMode ? "auth.pw.resetSuccess" : "auth.pw.changedSuccess"
      );
    } catch (submitError: unknown) {
      setError(getUpdatePasswordErrorMessage(submitError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(isRecoveryMode ? LOGIN_PATH : DASHBOARD_HOME_PATH, { replace: true });
  };

  const handleSuccessNavigate = async () => {
    if (isRecoveryMode) {
      // Only this browser needs to sign in again; a global sign-out would also
      // revoke the user's other active sessions for no security benefit.
      await supabase.auth.signOut({ scope: "local" });
      navigate(LOGIN_PATH, { replace: true });
      return;
    }

    navigate(DASHBOARD_HOME_PATH, { replace: true });
  };

  const canSubmit =
    !isLoading &&
    !isSuccess &&
    Boolean(newPassword) &&
    Boolean(confirmPassword) &&
    (isRecoveryMode || Boolean(oldPassword));

  return {
    isRecoveryMode,
    oldPassword,
    newPassword,
    confirmPassword,
    visibleFields,
    isLoading,
    isCheckingSession,
    error,
    successMessage,
    isSuccess,
    errorId,
    canSubmit,
    setOldPassword,
    setNewPassword,
    setConfirmPassword,
    toggleVisibility,
    clearErrorOnInput,
    handleSubmit,
    handleBack,
    handleSuccessNavigate,
  };
}
