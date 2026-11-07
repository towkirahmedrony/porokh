import React, { lazy, Suspense, useEffect } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

// Shared Components & Layouts
import { MainLayout } from '@/shared/components/layout/MainLayout';
import { PermissionGuard } from '@/features/auth/components/PermissionGuard';
import { OnboardingGate } from '@/features/onboarding/components/OnboardingGate';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useAuth } from '@/features/auth/hooks/useAuth';

// ==========================================
// ১. মূল ৫টি ট্যাব (সরাসরি ইম্পোর্ট - ইনস্ট্যান্ট নেভিগেশনের জন্য)
// ==========================================
import Home from '@/features/dashboard/pages/Home';
import History from '@/features/history/pages/History';
import UserProfile from '@/features/profile/pages/UserProfile';
import ModelCategoryPage from '@/features/exam/pages/ModelCategoryPage';
import ModelSubjectsPage from '@/features/exam/pages/ModelSubjectsPage';
import ModelPapersPage from '@/features/exam/pages/ModelPapersPage';
import {
  EXAM_TYPES,
  examListPath,
  isExamType,
} from '@/features/exam/constants/examTypes';
import { decideNativeStart } from './nativeStart';

// ==========================================
// ২. বাকি পেজগুলো (Lazy Loaded - মেমোরি বাঁচানোর জন্য)
// ==========================================
// Progress pulls in recharts, so keep it out of the startup entry. The chunk
// is prefetched shortly after mount to keep the tab feeling instant.
const Progress = lazy(() => import('@/features/progress/pages/Progress'));
const Streak = lazy(() => import('@/features/dashboard/pages/Streak'));
const Marketplace = lazy(() => import('@/features/economy/pages/Marketplace'));
const Login = lazy(() => import('@/features/auth/pages/Login'));
const Register = lazy(() => import('@/features/auth/pages/Register'));
const VerifyEmail = lazy(() => import('@/features/auth/pages/VerifyEmail'));
const Onboarding = lazy(() => import('@/features/onboarding/pages/Onboarding'));
const AuthCallback = lazy(() => import('@/features/auth/pages/AuthCallback'));
const ForgotPassword = lazy(() => import('@/features/auth/pages/ForgotPassword'));
const ChangePassword = lazy(() => import('@/features/auth/pages/ChangePassword'));
const Arena = lazy(() => import('@/features/exam/pages/Arena'));
const Analysis = lazy(() => import('@/features/exam/pages/Analysis'));
const QuestionBank = lazy(() => import('@/features/question-bank/pages/QuestionBank'));

// Admission (lazy loaded)
const AdmissionLandingPage = lazy(() =>
  import('@/features/admission/pages/AdmissionLandingPage')
);
const AdmissionUniversitiesPage = lazy(() =>
  import('@/features/admission/pages/AdmissionUniversitiesPage')
);
const AdmissionUnitListPage = lazy(() =>
  import('@/features/admission/pages/AdmissionUnitListPage')
);
const AdmissionUnitPage = lazy(() =>
  import('@/features/admission/pages/AdmissionUnitPage')
);
const AdmissionGroupPage = lazy(() =>
  import('@/features/admission/pages/AdmissionGroupPage')
);
const AdmissionUniversityListPage = lazy(() =>
  import('@/features/admission/pages/AdmissionUniversityListPage')
);
const AdmissionUniversityPage = lazy(() =>
  import('@/features/admission/pages/AdmissionUniversityPage')
);
const AdmissionExamListPage = lazy(() =>
  import('@/features/admission/pages/AdmissionExamListPage')
);
const AdmissionExamPage = lazy(() =>
  import('@/features/admission/pages/AdmissionExamPage')
);

// AI Chat Integration (Lazy Loaded)
const AIChatPage = lazy(() => import('@/features/ai/pages/AIChatPage'));

// Named exports-এর জন্য Lazy loading
const ChallengePlay = lazy(() =>
  import('@/features/exam/pages/ChallengePlay').then((m) => ({
    default: m.ChallengePlay,
  }))
);

const Contact = lazy(() =>
  import('@/features/contact/pages/Contact').then((m) => ({
    default: m.Contact,
  }))
);

const Notifications = lazy(() => import('@/features/notifications/pages/Notifications'));
const Notices = lazy(() => import('@/features/notices/pages/Notices'));
const NoticeDetail = lazy(() => import('@/features/notices/pages/NoticeDetail'));
const SupportCenter = lazy(() => import('@/features/support/pages/SupportCenter'));
const NewSupportTicket = lazy(() => import('@/features/support/pages/NewSupportTicket'));
const SupportTicketDetail = lazy(
  () => import('@/features/support/pages/SupportTicketDetail')
);
const PublicProfile = lazy(() => import('@/features/profile/pages/PublicProfile'));
const Settings = lazy(() => import('@/features/profile/pages/Settings'));
const EditProfile = lazy(() => import('@/features/profile/pages/EditProfile'));
const Referral = lazy(() => import('@/features/referral/pages/Referral'));
const Leaderboard = lazy(() => import('@/features/leaderboard/pages/Leaderboard'));
const PrivacyPolicy = lazy(() => import('@/features/legal/pages/PrivacyPolicy'));
const TermsConditions = lazy(() => import('@/features/legal/pages/TermsConditions'));
const AboutUs = lazy(() => import('@/features/legal/pages/AboutUs'));
const CookiePolicy = lazy(() => import('@/features/legal/pages/CookiePolicy'));
const FAQ = lazy(() => import('@/features/legal/pages/FAQ'));
const DataDeletion = lazy(() => import('@/features/legal/pages/DataDeletion'));

// Public marketing site (no session required)
const PublicLayout = lazy(
  () => import('@/features/marketing/components/PublicLayout')
);
const LandingPage = lazy(() => import('@/features/marketing/pages/LandingPage'));

// Subscription Pages (Lazy Loaded)
const Plans = lazy(() => import('@/features/subscription/pages/Plans'));
const Checkout = lazy(() => import('@/features/subscription/pages/Checkout'));

// Group & Squad Pages (Lazy Loaded)
const GroupsHub = lazy(() => import('@/features/groups/pages/GroupsHub'));
const CreateSquad = lazy(() => import('@/features/groups/pages/CreateSquad'));
const GroupRoute = lazy(() => import('@/features/groups/pages/GroupRoute'));
const GroupLeaderboard = lazy(() => import('@/features/groups/pages/GroupLeaderboard'));
const GroupBattle = lazy(() => import('@/features/groups/pages/GroupBattle'));


const FullPageLoader = () => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-900" />
);

/**
 * Startup screen of the Android app while the persisted session is restored.
 * It reuses the splash branding so the hand-off from the native splash does not
 * jump through a marketing page or a login form.
 *
 * `pk-start` is the exact background of the in-app splash
 * (src/splash/appSplash.ts) and of the Android launch theme, so the splash can
 * fade out over it without a colour jump.
 */
const AppStartLoader = () => (
  <div className="pk-start flex min-h-screen items-center justify-center">
    <img
      src="/icons/porokh-logo.svg"
      alt="Porokh (পরোখ)"
      className="h-24 w-auto animate-pulse"
    />
  </div>
);

/**
 * Root entry of the Android app.
 *
 * The website keeps the public marketing homepage at "/". The Android app
 * starts on the app itself: the dashboard when the stored session was restored,
 * the login page when there is none, and a loader while the session is still
 * loading.
 *
 * This component is rendered by the native-only `"*"` route, never inside
 * <PublicLayout>, so no marketing markup can mount before the decision is made.
 */
const NativeStartRoute = () => {
  const { loading, user } = useAuth();

  const start = decideNativeStart({
    native: Capacitor.isNativePlatform(),
    authLoading: loading,
    userId: user?.id ?? null,
  });

  if (start === 'landing') return <LandingPage />;
  if (start === 'loading') return <AppStartLoader />;

  return (
    <Navigate
      to={start === 'dashboard' ? '/dashboard/home' : '/auth/login'}
      replace
    />
  );
};

// Placeholder component
const Placeholder = ({ title }: { title: string }) => {
  const { t } = useLanguage();
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center">
      <EmptyState message={t('error.comingSoon', { title })} />
    </div>
  );
};

// NotFound Component
const NotFound = () => {
  const { t } = useLanguage();
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center">
      <EmptyState message={t('error.notFoundTitle')} />
    </div>
  );
};

const ExamListRoute = () => {
  const { type } = useParams<{ type: string }>();

  if (!isExamType(type)) {
    return <NotFound />;
  }

  if (type === EXAM_TYPES.model.type) {
    return <ModelCategoryPage />;
  }

  if (type === EXAM_TYPES.board.type) {
    return <Navigate to={examListPath(EXAM_TYPES.model.type)} replace />;
  }

  return <AdmissionLandingPage />;
};

const LegacyExamSelectionRedirect = () => {
  const [searchParams] = useSearchParams();
  const requestedType = searchParams.get('type');
  const type = isExamType(requestedType)
    ? requestedType
    : EXAM_TYPES.model.type;

  return <Navigate to={examListPath(type)} replace />;
};

const LegacyQuestionBankRedirect = () => {
  const location = useLocation();

  return (
    <Navigate
      to={{ pathname: '/question-bank', search: location.search }}
      replace
    />
  );
};

const AppRoutes: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const userId = user?.id;
  // The Android shell is the app only; the public marketing site exists solely
  // on the website. Read per render so it follows the bridge's actual platform.
  const nativeShell = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!userId) return;

    const preloadProgress = () => {
      void import('@/features/progress/pages/Progress');
    };
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(preloadProgress, { timeout: 4000 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }

    const timer = window.setTimeout(preloadProgress, 4000);
    return () => window.clearTimeout(timer);
  }, [userId]);

  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        {/* --- Public auth routes --- */}
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register" element={<Register />} />
        <Route path="/auth/verify-email" element={<VerifyEmail />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />

        {/*
          Password reset route must stay public.
          Supabase recovery links may open this route before the normal auth guard is ready.
          ChangePassword itself validates/exchanges the recovery token/session.
        */}
        <Route path="/auth/change-password" element={<ChangePassword />} />

        {/*
          Backward compatibility:
          Old internal links using /change-password will still work.
          The component will redirect unauthenticated normal users to login by itself.
        */}
        <Route path="/change-password" element={<ChangePassword />} />

        {/*
          --- Public information routes ---
          These pages are reachable without a session: no guard, no app shell
          and no authenticated request. Search crawlers and anonymous visitors
          get the same markup; the app routes below stay behind PermissionGuard.

          The homepage is website-only: inside the Android app "/" belongs to
          the app itself, so it must not be declared here at all. The legal and
          informational pages stay routable because the app links to them too.
        */}
        <Route element={<PublicLayout />}>
          {!nativeShell && <Route path="/" element={<LandingPage />} />}
          <Route path="/about" element={<AboutUs />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-conditions" element={<TermsConditions />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />
          <Route path="/data-deletion" element={<DataDeletion />} />

          {/* Public 404: a lost visitor keeps the site navigation. */}
          {!nativeShell && <Route path="*" element={<NotFound />} />}
        </Route>

        {/*
          Android entry point. It is declared outside <PublicLayout>, so no
          marketing header, footer or homepage can paint while the persisted
          session is still being restored. In the app "/" and every path this
          build does not serve resolve to the app's own first screen; the
          website keeps the marketing homepage declared above.
        */}
        {nativeShell && <Route path="*" element={<NativeStartRoute />} />}

        {/* --- Post-verification onboarding (outside the app shell) --- */}
        <Route
          path="/onboarding"
          element={
            <OnboardingGate>
              <Onboarding />
            </OnboardingGate>
          }
        />

        {/* --- Fullscreen protected routes --- */}
        <Route
          path="/exam/selection"
          element={<LegacyExamSelectionRedirect />}
        />

        <Route
          path="/exams"
          element={<Navigate to={examListPath(EXAM_TYPES.model.type)} replace />}
        />

        <Route
          path="/exams/model/:track"
          element={
            <PermissionGuard>
              <ModelSubjectsPage />
            </PermissionGuard>
          }
        />

        <Route
          path="/exams/model/:track/:subjectId"
          element={
            <PermissionGuard>
              <ModelPapersPage />
            </PermissionGuard>
          }
        />

        <Route
          path="/exams/:type"
          element={
            <PermissionGuard>
              <ExamListRoute />
            </PermissionGuard>
          }
        />

        <Route
          path="/exam/live"
          element={
            <PermissionGuard>
              <Arena />
            </PermissionGuard>
          }
        />

        {/* Legacy subject deep links now belong to the preset model-test
            catalogue. /exam/live (no slug) keeps the generated Arena flow. */}
        <Route
          path="/exam/live/:subjectSlug"
          element={<Navigate to="/exams/model" replace />}
        />

        {/* Practice attempts are server-issued, so the attempt id is part of
            the URL. A refresh resumes the same attempt and deadline. */}
        <Route
          path="/exam/attempt/:attemptId"
          element={
            <PermissionGuard>
              <Arena />
            </PermissionGuard>
          }
        />

        <Route
          path="/exam/analysis"
          element={
            <PermissionGuard>
              <Analysis />
            </PermissionGuard>
          }
        />

        <Route
          path="/exam/analysis/:id"
          element={
            <PermissionGuard>
              <Analysis />
            </PermissionGuard>
          }
        />

        {/* ChallengePlay reads the challenge id from the route, so the id is
            part of the path (deep links and refresh both work). */}
        <Route
          path="/exam/challenge-play/:challengeId"
          element={
            <PermissionGuard>
              <ChallengePlay />
            </PermissionGuard>
          }
        />

        {/*
          Admission exams use a fullscreen shell and the existing
          server-issued attempt/submission lifecycle.
          Declared with static segments so it outranks
          "/admission/:groupSlug/:examType".
        */}
        <Route
          path="/admission/exam/:examId"
          element={
            <PermissionGuard>
              <AdmissionExamPage />
            </PermissionGuard>
          }
        />

        <Route
          path="/parasathi"
          element={
            <PermissionGuard>
              <AIChatPage />
            </PermissionGuard>
          }
        />

        <Route
          path="/premium/checkout/:planId"
          element={
            <PermissionGuard>
              <Checkout />
            </PermissionGuard>
          }
        />

        <Route
          path="/notifications"
          element={
            <PermissionGuard>
              <Notifications />
            </PermissionGuard>
          }
        />

        <Route
          path="/notices"
          element={
            <PermissionGuard>
              <Notices />
            </PermissionGuard>
          }
        />

        <Route
          path="/notices/:id"
          element={
            <PermissionGuard>
              <NoticeDetail />
            </PermissionGuard>
          }
        />

        <Route
          path="/settings"
          element={
            <PermissionGuard>
              <Settings />
            </PermissionGuard>
          }
        />

        <Route
          path="/edit-profile"
          element={
            <PermissionGuard>
              <EditProfile />
            </PermissionGuard>
          }
        />

        <Route
          path="/profile/view/:id"
          element={
            <PermissionGuard>
              <PublicProfile />
            </PermissionGuard>
          }
        />

        {/* Public group preview; authenticated users see the full group. */}
        <Route path="/groups/:groupId" element={<GroupRoute />} />

        {/*
          --- Authenticated application shell (With Sidebar & Header & BottomNav) ---
          The parent is pathless and guarded, so every child keeps its existing
          absolute URL (deep links, bookmarks and the Android WebView routes
          stay valid) while "/" belongs to the public marketing site.
        */}
        <Route
          element={
            <PermissionGuard>
              <MainLayout />
            </PermissionGuard>
          }
        >
          <Route path="/dashboard" element={<Navigate to="/dashboard/home" replace />} />

          {/* Dashboard & Gamification */}
          <Route path="/dashboard/home" element={<Home />} />
          <Route path="/dashboard/streak" element={<Streak />} />
          <Route path="/dashboard/leaderboard" element={<Leaderboard />} />
          <Route path="/dashboard/marketplace" element={<Marketplace />} />
          <Route path="/progress" element={<Progress />} />

          <Route path="/quests" element={<Placeholder title={t('placeholder.quests')} />} />

          {/* History & Analytics */}
          <Route path="/history" element={<History />} />

          {/* User Profile & Economy */}
          <Route path="/profile" element={<UserProfile />} />
          <Route path="/referral" element={<Referral />} />

          {/* Premium Showcase */}
          <Route path="/premium" element={<Plans />} />

          {/* Group & Social */}
          <Route path="/groups" element={<GroupsHub />} />
          <Route path="/groups/new" element={<CreateSquad />} />
          <Route path="/groups/leaderboard" element={<GroupLeaderboard />} />
          <Route path="/groups/:groupId/battles/:battleId" element={<GroupBattle />} />
          <Route path="/group" element={<Navigate to="/groups" replace />} />
          <Route path="/group/:groupId/battle" element={<Navigate to="/groups" replace />} />
          <Route path="/group/:groupId/focus" element={<Placeholder title={t('placeholder.focusSession')} />} />

          {/* Admission — unit-first flow: Admission → University → Unit.
              Static segments outrank the legacy group routes below, which stay
              in place for existing links. */}
          <Route path="/admission" element={<AdmissionUniversitiesPage />} />
          <Route
            path="/admission/university/:universityId"
            element={<AdmissionUnitListPage />}
          />
          <Route
            path="/admission/university/:universityId/unit/:unitId"
            element={<AdmissionUnitPage />}
          />

          {/* Legacy group-first admission routes (kept for backward compatibility) */}
          <Route path="/admission/:groupSlug" element={<AdmissionGroupPage />} />
          <Route
            path="/admission/:groupSlug/:examType"
            element={<AdmissionUniversityListPage />}
          />
          <Route
            path="/admission/:groupSlug/:examType/:universitySlug"
            element={<AdmissionUniversityPage />}
          />
          <Route
            path="/admission/:groupSlug/:examType/:universitySlug/exams"
            element={<AdmissionExamListPage />}
          />

          {/* Academic & Materials */}
          <Route path="/suggestion" element={<Placeholder title={t('placeholder.suggestion')} />} />
          <Route path="/bank" element={<LegacyQuestionBankRedirect />} />
          <Route path="/question-bank" element={<QuestionBank />} />
          <Route path="/materials" element={<Placeholder title={t('placeholder.materials')} />} />

          {/* Support & Moderation */}
          <Route path="/support" element={<SupportCenter />} />
          <Route path="/support/new" element={<NewSupportTicket />} />
          <Route path="/support/:ticketId" element={<SupportTicketDetail />} />

          {/* 404 inside the app shell, so a signed-in user keeps the navigation */}
          <Route path="/dashboard/*" element={<NotFound />} />
        </Route>

      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
