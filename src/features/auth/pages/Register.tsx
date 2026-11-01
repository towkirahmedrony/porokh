import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import RegisterForm from '../components/RegisterForm';
import { rememberPendingVerificationEmail } from '../utils/pendingVerification';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref');
  const { t } = useLanguage();

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center px-4 py-8 bg-app">
      <div className="w-full max-w-[400px] flex flex-col items-center">
        
        {/* Logo, Title and Subtitle */}
        <div className="mb-8 flex flex-col items-center">
          <img 
            src="https://res.cloudinary.com/dqpv45947/image/upload/v1776877967/parapoth_media/qovc0qtol9p0taeuc2bu.png" 
            alt="Porokh logo" 
            className="h-12 w-auto object-contain drop-shadow-sm mb-2"
          />
          <h1 className="text-2xl font-bold tracking-tight mb-0.5 text-text-primary">
            {t('brand.name')}
          </h1>
          <p className="text-[13px] font-medium tracking-[0.08em] uppercase text-text-secondary">
            {t('auth.brandTagline')}
          </p>
          
          {refCode && (
            <div className="mt-3 px-4 py-1.5 rounded-full bg-badge-bg border border-border-color">
              <p className="text-xs font-bold text-badge-text">
                {t('auth.referralCodeActive', { code: refCode })}
              </p>
            </div>
          )}
        </div>

        {/* Registration Form */}
        <RegisterForm
          defaultRefCode={refCode}
          onSuccess={(email) => {
            rememberPendingVerificationEmail(email);
            navigate('/auth/verify-email', {
              replace: true,
              state: { email },
            });
          }}
        />

        {/* Bottom Login Link (Text Only) */}
        <div className="w-full mt-6 flex justify-center items-center text-[15px]">
          <span className="text-text-secondary">
            {t('auth.hasAccount')}
          </span>
          <Link 
            to="/auth/login" 
            className="font-bold ml-1.5 text-text-primary hover:text-text-secondary hover:underline transition-colors"
          >
            {t('auth.loginCta')}
          </Link>
        </div>

      </div>
    </div>
  );
}
