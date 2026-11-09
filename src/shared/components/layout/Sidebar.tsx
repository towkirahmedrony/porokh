import React, { memo } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Trophy, FileEdit, PieChart, User as UserIcon, LogOut, History, Settings as SettingsIcon, GraduationCap, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { supabase } from '@/shared/lib/supabase';
import { EXAM_TYPES, examListPath } from '@/features/exam/constants/examTypes';

export const Sidebar: React.FC = memo(() => {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();

  const { data: profileData } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 30, // 30 minutes cache
  });

  // Safely extract string to prevent "Objects are not valid as a React child" error
  const extractName = (val: any): string | null => {
    if (!val) return null;
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val.full_name) return String(val.full_name);
    return null;
  };

  const fullNameStr = extractName(profileData) || extractName(user?.user_metadata) || extractName(user?.user_metadata?.full_name) || t('home.studentFallback');
  const initialStr = fullNameStr ? fullNameStr.charAt(0).toUpperCase() : 'S';

  // Nav labels always follow the active application language.
  const navItems = [
    { label: t('nav.home'), path: '/dashboard/home', icon: Home },
    { label: t('nav.modelTest'), path: examListPath(EXAM_TYPES.model.type), icon: FileEdit },
    { label: t('nav.admission'), path: '/admission', icon: GraduationCap },
    { label: t('nav.progress'), path: '/progress', icon: PieChart },
    { label: t('nav.leaderboard'), path: '/dashboard/leaderboard', icon: Trophy },
    { label: t('nav.groups'), path: '/groups', icon: Users },
    { label: t('nav.history'), path: '/history', icon: History },
    { label: t('nav.profile'), path: '/profile', icon: UserIcon },
    { label: t('nav.settings'), path: '/settings', icon: SettingsIcon },
  ];

  return (
    <aside 
      className="hidden md:flex flex-col w-64 h-screen sticky top-0 border-r border-border-color transition-colors duration-500 bg-surface text-text-primary"
    >
      <div className="h-20 flex items-center px-6 border-b border-border-color">
        <span className="text-2xl font-bold font-['Noto_Sans_Bengali'] text-primary">
          {t('brand.name')}
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 font-['Noto_Sans_Bengali'] ${
                isActive 
                  ? 'shadow-sm font-bold bg-accent text-primary' 
                  : 'text-text-secondary hover:text-text-primary hover:bg-secondary hover:scale-[1.02]'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border-color">
        <div className="flex items-center gap-3 mb-4 p-2 rounded-lg bg-secondary">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold uppercase shadow-sm flex-shrink-0 bg-primary text-primary-foreground"
          >
            {initialStr}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-bold truncate font-['Noto_Sans_Bengali'] text-text-primary">
              {fullNameStr}
            </p>
            <p className="text-xs truncate text-text-secondary">
              {user?.email || 'student@porokh.com'}
            </p>
          </div>
        </div>
        
        <button 
          onClick={() => signOut()}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm rounded-lg transition-colors border border-transparent text-text-primary bg-secondary hover:bg-accent hover:text-primary"
        >
          <LogOut className="w-4 h-4" />
          <span className="font-['Noto_Sans_Bengali']">{t('nav.logout')}</span>
        </button>
      </div>
    </aside>
  );
});

Sidebar.displayName = 'Sidebar';
export default Sidebar;
