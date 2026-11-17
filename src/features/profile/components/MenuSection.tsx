import React, { memo, useCallback, useState } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { Gift, Settings as SettingsIcon, LogOut, ChevronRight, LifeBuoy, Lock, Moon, Sun, Shield, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth'; 
import { useTheme } from '@/shared/hooks/useTheme';

const MenuSection: React.FC = memo(() => {
  const { t } = useLanguage();
  const { signOut } = useAuth(); 
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  const [isLegalOpen, setIsLegalOpen] = useState(() => {
    return localStorage.getItem('isLegalMenuOpen') === 'true';
  });

  const handleLegalToggle = useCallback(() => {
    setIsLegalOpen(prev => {
      const newState = !prev;
      localStorage.setItem('isLegalMenuOpen', String(newState));
      return newState;
    });
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      if (signOut) await signOut();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }, [signOut]);

  // The switch reflects the resolved theme, so it stays correct when the
  // preference is `system` (the default) and the device is in dark mode.
  const isDarkMode = resolvedTheme === 'dark';

  return (
    <div className="rounded-3xl overflow-hidden shadow-sm transition-all duration-300 bg-card-bg border border-card-border pb-2">
      <div className="px-5 py-4 mb-2 bg-surface border-b border-border-color">
        <h3 className="text-xs font-bold uppercase tracking-wider font-['Noto_Sans_Bengali'] text-text-secondary">
          {t('profile.accountSettings')}
        </h3>
      </div>

      {/* নতুন মার্কেটপ্লেস মেনু */}
      <MenuItem icon={<Store size={18}/>} label={t('profile.marketplace')} onClick={() => navigate('/dashboard/marketplace')} />
      
      <MenuItem icon={<Gift size={18}/>} label={t('profile.referral')} onClick={() => navigate('/referral')} />
      <MenuItem icon={<Lock size={18}/>} label={t('profile.changePassword')} onClick={() => navigate('/change-password')} />
      
      <MenuItem 
        icon={isDarkMode ? <Moon size={18} /> : <Sun size={18} />} 
        label={t('profile.darkMode')}
        onClick={toggleTheme} 
        rightElement={
          <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ease-in-out ${isDarkMode ? 'bg-primary' : 'bg-surface-elevated border border-border-color'}`}>
            <div 
              className={`w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ease-in-out bg-surface ${isDarkMode ? 'translate-x-5' : 'translate-x-0'}`} 
            />
          </div>
        }
      />
      
      <MenuItem icon={<SettingsIcon size={18} />} label={t('profile.settings')} onClick={() => navigate('/settings')} />
      <MenuItem icon={<LifeBuoy size={18} />} label={t('profile.supportCenter')} onClick={() => navigate('/support')} />

      {/* Expandable Legal Section */}
      <div>
        <button 
          onClick={handleLegalToggle}
          className="w-full flex items-center justify-between px-5 py-3.5 transition-colors group hover:bg-surface-elevated"
        >
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-xl transition-colors bg-surface-elevated text-primary">
              <Shield size={18} />
            </div>
            <span className="font-medium font-['Noto_Sans_Bengali'] text-text-primary">{t('profile.helpLegal')}</span>
          </div>
          <ChevronRight size={18} className={`transition-transform duration-300 text-text-secondary ${isLegalOpen ? 'rotate-90' : ''}`} />
        </button>

        <div className="transition-all duration-300 ease-in-out overflow-hidden" style={{ maxHeight: isLegalOpen ? '600px' : '0px', opacity: isLegalOpen ? 1 : 0 }}>
          <div className="py-2 ml-[3.25rem] border-l-2 mr-5 border-border-color">
            <SubMenuItem label={t('profile.helpSupport')} onClick={() => navigate('/contact')} />
            <SubMenuItem label={t('profile.faq')} onClick={() => navigate('/faq')} />
            <SubMenuItem label={t('profile.about')} onClick={() => navigate('/about')} />
            <SubMenuItem label={t('profile.privacy')} onClick={() => navigate('/privacy-policy')} />
            <SubMenuItem label={t('profile.terms')} onClick={() => navigate('/terms-conditions')} />
            <SubMenuItem label={t('profile.dataDeletion')} onClick={() => navigate('/data-deletion')} danger={true} />
          </div>
        </div>
      </div>
      
      <div className="h-px mx-5 my-2 bg-border-color" />
      
      <button 
        onClick={handleLogout} 
        className="w-full flex items-center justify-between px-5 py-3.5 transition-colors group hover:bg-surface-elevated"
      >
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xl transition-colors bg-surface-elevated text-red-500">
            <LogOut size={18} />
          </div>
          <span className="font-medium font-['Noto_Sans_Bengali'] text-red-500">{t('profile.logout')}</span>
        </div>
      </button>
    </div>
  );
});

MenuSection.displayName = 'MenuSection';

interface MenuItemProps { 
  icon: React.ReactNode; 
  label: string; 
  onClick?: () => void; 
  rightElement?: React.ReactNode; 
}

const MenuItem: React.FC<MenuItemProps> = memo(({ icon, label, onClick, rightElement }) => (
  <button onClick={onClick} className="w-full flex items-center justify-between px-5 py-3.5 transition-colors group hover:bg-surface-elevated">
    <div className="flex items-center gap-4">
      <div className="p-2 rounded-xl transition-colors bg-surface-elevated text-primary">
        {icon}
      </div>
      <span className="font-medium font-['Noto_Sans_Bengali'] text-text-primary">{label}</span>
    </div>
    {rightElement ? rightElement : <ChevronRight size={18} className="text-text-secondary" />}
  </button>
));

MenuItem.displayName = 'MenuItem';

const SubMenuItem: React.FC<{ label: string; onClick?: () => void; danger?: boolean; }> = memo(({ label, onClick, danger }) => (
  <button onClick={onClick} className="w-full flex items-center justify-start py-2 pl-4 transition-colors hover:pl-5 duration-200">
    <span className={`font-medium font-['Noto_Sans_Bengali'] text-[13px] ${danger ? 'text-red-500' : 'text-text-secondary'}`}>
      {label}
    </span>
  </button>
));

SubMenuItem.displayName = 'SubMenuItem';

export default MenuSection;
