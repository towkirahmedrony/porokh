import React from 'react';
import { MainLayout } from '@/shared/components/layout/MainLayout';
import { useAuth } from '@/features/auth/hooks/useAuth';
import GroupDetail from './GroupDetail';
import GroupPreviewPage from './GroupPreviewPage';

/**
 * `/groups/:slug` is public so an invite link can be previewed before login.
 * Signed-in students get the full group inside the normal app shell.
 */
const GroupRoute: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-app" />;
  }

  if (!user) return <GroupPreviewPage />;

  return (
    <MainLayout>
      <GroupDetail />
    </MainLayout>
  );
};

export default GroupRoute;
