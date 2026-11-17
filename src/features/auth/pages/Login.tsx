import { Link } from 'react-router-dom';
import LoginForm from '../components/LoginForm';
import SocialLogin from '../components/SocialLogin';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

export default function Login() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center px-4 py-8 bg-app">
      <div className="w-full max-w-[400px] flex flex-col items-center">
        
        {/* Logo, Title and Subtitle */}
        <div className="mb-8 flex flex-col items-center">
          <img 
            src="/icons/header.webp" 
            alt="Porokh (পরোখ) logo" 
            width={720}
            height={240}
            className="h-12 w-auto object-contain drop-shadow-sm mb-2"
          />
          <h1 className="text-2xl font-bold tracking-tight mb-0.5 text-text-primary">
            {t('brand.name')}
          </h1>
          <p className="text-[13px] font-medium tracking-[0.08em] uppercase text-text-secondary">
            {t('auth.brandTagline')}
          </p>
        </div>

        {/* Form Elements */}
        <LoginForm />

        {/* Social Login Buttons */}
        <SocialLogin />

        {/* Bottom Registration Link */}
        <div className="w-full mt-6 flex justify-center items-center text-[15px]">
          <span className="text-text-secondary">
            {t('auth.noAccount')}
          </span>
          <Link 
            to="/auth/register" 
            className="font-bold ml-1.5 text-text-primary hover:text-text-secondary hover:underline transition-colors"
          >
            {t('auth.signUp')}
          </Link>
        </div>
        
      </div>
    </div>
  );
}
