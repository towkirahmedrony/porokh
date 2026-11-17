import React from 'react';
import Lottie from 'lottie-react';
// ইম্পোর্ট পাথ ফিক্স করা হয়েছে নতুন ফোল্ডার স্ট্রাকচার অনুযায়ী
import emptyAnim from '@/assets/animations/empty-box.json';

// এক্সপোর্ট করা হলো যাতে অন্য কম্পোনেন্ট টাইপ ইমপোর্ট করতে পারে
export interface EmptyStateProps {
  title?: string;
  message?: string;
}

// React.memo যুক্ত করা হলো পারফরম্যান্স অপ্টিমাইজেশনের জন্য
export const EmptyState: React.FC<EmptyStateProps> = React.memo(({ title, message }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center animate-in fade-in zoom-in duration-500">
      {/* এনিমেশন কন্টেইনার */}
      <div className="w-52 h-52 md:w-64 md:h-64 opacity-90 mb-4 pointer-events-none">
        <Lottie 
          animationData={emptyAnim} 
          loop={true} 
          autoplay={true}
        />
      </div>
      
      {/* টাইটেল টেক্সট (যদি দেওয়া থাকে) */}
      {title && (
        <h3 className="font-['Noto_Sans_Bengali'] text-xl font-bold mb-2 text-text-primary">
          {title}
        </h3>
      )}

      {/* মেসেজ টেক্সট (যদি দেওয়া থাকে) */}
      {message && (
        <p className="font-['Noto_Sans_Bengali'] text-base md:text-lg font-medium max-w-sm mx-auto leading-relaxed text-text-secondary">
          {message}
        </p>
      )}
    </div>
  );
});

EmptyState.displayName = 'EmptyState';

export default EmptyState;
