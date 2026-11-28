import React, { lazy, Suspense, useEffect } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom';

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
const QuestionBankHub = lazy(
  () => import('@/features/question-bank/pages/QuestionBankHub')
);
const QuestionBankInstitutions = lazy(
  () => import('@/features/question-bank/pages/QuestionBankInstitutions')
);
const QuestionBankUniversity = lazy(
  () => import('@/features/question-bank/pages/QuestionBankUniversity')
);

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
const NotificationPrivacy = lazy(() => import('@/features/profile/pages/NotificationPrivacy'));
const NotificationSettings = lazy(() => import('@/features/profile/pages/NotificationSettings'));
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
const AcademicProfile = lazy(
  () => import('@/features/profile/pages/AcademicProfile')
);
const Referral = lazy(() => import('@/features/referral/pages/Referral'));
const Leaderboard = lazy(() => import('@/features/leaderboard/pages/Leaderboard'));
const PrivacyPolicy = lazy(() => import('@/features/legal/pages/PrivacyPolicy'));
const TermsConditions = lazy(() => import('@/features/legal/pages/TermsConditions'));
const CookiePolicy = lazy(() => import('@/features/legal/pages/CookiePolicy'));
const DataDeletion = lazy(() => import('@/features/legal/pages/DataDeletion'));

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
 * Startup screen while the persisted session is restored.
 *
 * It reuses the splash branding so the hand-off from the native splash does not
 * jump through a login form for a user whose session is simply not read yet.
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
 * Entry point of the student app, shared by the web build and the Android shell.
 *
 * Porokh is the exam app only: "/" is never a public page. A restored session
 * lands on the dashboard, no session lands on the login screen, and a session
 * that is still being restored keeps the splash instead of flashing either.
 * The destination is `/dashboard`, whose own route sends the student to the
 * dashboard home tab.
 */
const RootRoute = () => {
  const { loading, user } = useAuth();

  if (loading) return <AppStartLoader />;

  return <Navigate to={user ? '/dashboard' : '/auth/login'} replace />;
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

/**
 * `/question-bank` is the hub. A URL that carries any of the list's filter keys
 * is an old deep link (a shared subject, a notification, a bookmark), so it is
 * sent to the list with its query untouched instead of being read as a hub tab.
 */
const QUESTION_BANK_LIST_KEYS = [
  'q',
  'subject',
  'chapter',
  'topic',
  'source',
  'institution',
  'institutionId',
  'year',
  'university',
  'unit',
  'level',
  'track',
  'allTracks',
  'bookmarked',
  'mistakes',
  'premium',
  'sort',
  'view',
] as const;

const QuestionBankEntry = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isListUrl = QUESTION_BANK_LIST_KEYS.some((key) => params.has(key));

  if (isListUrl) {
    return (
      <Navigate
        to={{ pathname: '/question-bank/list', search: location.search }}
        replace
      />
    );
  }

  return <QuestionBankHub />;
};

const AppRoutes: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const userId = user?.id;

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
          --- Student app entry point ---
          "/" belongs to the exam app itself: a restored session goes to the
          dashboard, no session goes to the login screen. The decision waits for
          the persisted session, so a signed-in student never sees the login
          form flash before the dashboard.
        */}
        <Route path="/" element={<RootRoute />} />

        {/*
          Short aliases for the two entry screens. `/auth/login` and
          `/auth/register` stay canonical (every internal link uses them), while
          `/login` and `/register` links from docs, store listings and old
          bookmarks resolve to the same pages instead of a 404.
        */}
        <Route path="/login" element={<Navigate to="/auth/login" replace />} />
        <Route path="/register" element={<Navigate to="/auth/register" replace />} />

        {/*
          --- Public support and legal pages ---
          Reachable without a session: no guard, no app shell and no
          authenticated request. Profile, Settings and notification privacy link
          to them, and the store listing needs the privacy policy public. Each
          renders its own full-page layout, so no marketing chrome is involved.
        */}
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-conditions" element={<TermsConditions />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />
        <Route path="/data-deletion" element={<DataDeletion />} />

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

        {/* Admission is its own unit-first hub now; the old model-test
            "University" track only forwards there. */}
        <Route
          path="/exams/admission"
          element={<Navigate to="/admission" replace />}
        />
        <Route
          path="/exams/model/varsity"
          element={<Navigate to="/admission" replace />}
        />
        <Route
          path="/exams/model/varsity/:subjectId"
          element={<Navigate to="/admission" replace />}
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
          path="/notifications-privacy"
          element={
            <PermissionGuard>
              <NotificationPrivacy />
            </PermissionGuard>
          }
        />
        <Route
          path="/notification-settings"
          element={
            <PermissionGuard>
              <NotificationSettings />
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
          path="/profile/academic"
          element={
            <PermissionGuard>
              <AcademicProfile />
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
          stay valid) while "/" is owned by `RootRoute` above.
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

          {/* Admission — unit-first flow: Admission → University → Unit → Hub.
              The hub tab is a query parameter (`?tab=papers|models|bank`). */}
          <Route path="/admission" element={<AdmissionUniversitiesPage />} />

          {/* Old bookmarks from the group-first and id-based flows land on the
              new university grid instead of a broken deep link. */}
          <Route
            path="/admission/university/:universityId"
            element={<Navigate to="/admission" replace />}
          />
          <Route
            path="/admission/university/:universityId/unit/:unitId"
            element={<Navigate to="/admission" replace />}
          />
          <Route
            path="/admission/:groupSlug/past-exams/*"
            element={<Navigate to="/admission" replace />}
          />
          <Route
            path="/admission/:groupSlug/model-test/*"
            element={<Navigate to="/admission" replace />}
          />
          <Route
            path="/admission/science"
            element={<Navigate to="/admission" replace />}
          />
          <Route
            path="/admission/arts"
            element={<Navigate to="/admission" replace />}
          />
          <Route
            path="/admission/commerce"
            element={<Navigate to="/admission" replace />}
          />

          <Route
            path="/admission/:institutionSlug"
            element={<AdmissionUnitListPage />}
          />
          <Route
            path="/admission/:institutionSlug/:unitCode"
            element={<AdmissionUnitPage />}
          />

          {/* Academic & Materials */}
          <Route path="/suggestion" element={<Placeholder title={t('placeholder.suggestion')} />} />
          <Route path="/bank" element={<LegacyQuestionBankRedirect />} />
          <Route path="/question-bank" element={<QuestionBankEntry />} />
          <Route path="/question-bank/list" element={<QuestionBank />} />
          <Route
            path="/question-bank/colleges"
            element={<QuestionBankInstitutions kind="colleges" />}
          />
          <Route
            path="/question-bank/universities"
            element={<QuestionBankInstitutions kind="universities" />}
          />
          <Route
            path="/question-bank/university/:institutionId"
            element={<QuestionBankUniversity />}
          />
          <Route path="/materials" element={<Placeholder title={t('placeholder.materials')} />} />

          {/* Support & Moderation */}
          <Route path="/support" element={<SupportCenter />} />
          <Route path="/support/new" element={<NewSupportTicket />} />
          <Route path="/support/:ticketId" element={<SupportTicketDetail />} />

          {/* 404 inside the app shell, so a signed-in user keeps the navigation.
              The splat only matches URLs no other route claims, and because the
              shell is guarded an anonymous visitor is sent to login instead. */}
          <Route path="*" element={<NotFound />} />
        </Route>

      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
