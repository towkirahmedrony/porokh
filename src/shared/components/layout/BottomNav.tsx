import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Trophy, Play, PieChart, User, LucideIcon } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { EXAM_TYPES, examListPath } from '@/features/exam/constants/examTypes';

const NAV_LINK_CONTAINER_CLASS = "w-full h-full flex items-center justify-center";

interface NavItemProps {
  Icon: LucideIcon | React.ElementType;
  label: string;
  isActive: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ Icon, label, isActive }) => (
  <div
    className={`flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-2xl transition-all duration-300 ${
      isActive 
        ? 'shadow-sm scale-105 font-bold bg-accent text-text-primary' 
        : 'font-medium opacity-70 hover:opacity-100 text-nav-text bg-transparent'
    }`}
  >
    <Icon className="w-6 h-6" aria-hidden="true" />
    <span className="text-[10px] font-['Noto_Sans_Bengali']">{label}</span>
  </div>
);

const BottomNav: React.FC = () => {
  const location = useLocation();
  const { t } = useLanguage();
  
  if (location.pathname.startsWith('/exam/arena')) {
    return null;
  }

  return (
    <nav 
      className="md:hidden h-20 border-t border-border-color pb-2 fixed bottom-0 w-full z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] transition-colors duration-500 bg-nav-bg"
      aria-label={t('nav.bottomLabel')}
    >
      <div className="grid grid-cols-5 h-full relative px-2 items-center">
        
        <NavLink to="/dashboard/home" className={NAV_LINK_CONTAINER_CLASS}>
          {({ isActive }) => (
            <NavItem Icon={Home} label={t('nav.home')} isActive={isActive} />
          )}
        </NavLink>

        <NavLink to="/progress" className={NAV_LINK_CONTAINER_CLASS}>
          {({ isActive }) => (
            <NavItem Icon={PieChart} label={t('nav.progress')} isActive={isActive} />
          )}
        </NavLink>

        {/* Floating Exam Button */}
        <div className="relative flex items-center justify-center -mt-8">
          <NavLink
            to={examListPath(EXAM_TYPES.model.type)}
            className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 border-[6px] border-surface bg-primary text-primary-foreground"
            aria-label={t('nav.startExam')}
          >
            <Play className="w-7 h-7 fill-current ml-1" aria-hidden="true" />
          </NavLink>
        </div>

        <NavLink to="/history" className={NAV_LINK_CONTAINER_CLASS}>
          {({ isActive }) => (
            <NavItem Icon={Trophy} label={t('nav.history')} isActive={isActive} />
          )}
        </NavLink>

        <NavLink to="/profile" className={NAV_LINK_CONTAINER_CLASS}>
          {({ isActive }) => (
            <NavItem Icon={User} label={t('nav.profile')} isActive={isActive} />
          )}
        </NavLink>

      </div>
    </nav>
  );
};

export default BottomNav;
