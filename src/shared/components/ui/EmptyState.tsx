import React from 'react';
import Lottie from 'lottie-react';
import defaultAnim from '@/assets/animations/empty-box.json';

interface EmptyStateProps {
  message: string;
  subMessage?: string;
  animationData?: any;
}

const EmptyState: React.FC<EmptyStateProps> = ({ 
  message, 
  subMessage, 
  animationData 
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center animate-in fade-in zoom-in duration-500">
      <div className="w-52 h-52 md:w-64 md:h-64 opacity-90 mb-4">
        <Lottie 
          animationData={animationData || defaultAnim} 
          loop={true} 
          autoplay={true}
        />
      </div>
      
      <h3 className="text-text-primary font-['Noto_Sans_Bengali'] text-lg font-semibold mb-2">
        {message}
      </h3>
      
      {subMessage && (
        <p className="text-text-secondary font-['Noto_Sans_Bengali'] text-sm max-w-xs mx-auto leading-relaxed">
          {subMessage}
        </p>
      )}
    </div>
  );
};

export default EmptyState;
