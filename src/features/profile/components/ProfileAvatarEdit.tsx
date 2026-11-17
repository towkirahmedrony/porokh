import React, { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { supabase } from '../../../shared/lib/supabase';
import { PROFILE_DEFAULTS } from '../utils/profileConstants';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

interface ProfileAvatarEditProps {
  userId?: string;
  currentAvatarUrl?: string | null;
  onAvatarUpdate: (newUrl: string) => void;
}

const ProfileAvatarEdit: React.FC<ProfileAvatarEditProps> = ({ userId, currentAvatarUrl, onAvatarUpdate }) => {
  const { t } = useLanguage();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayUrl = currentAvatarUrl || PROFILE_DEFAULTS.AVATAR_URL;

  const handleImageClick = () => {
    if (!isUploading) fileInputRef.current?.click();
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    try {
      setIsUploading(true);

      // 1. Compress Image (Max 150KB)
      const options = { maxSizeMB: 0.15, maxWidthOrHeight: 500, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);

      // 2. Upload to Supabase 'avatars' bucket
      const fileExt = compressedFile.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, compressedFile, { upsert: true });

      if (uploadError) throw uploadError;

      // 3. Get Public URL
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

      // 4. Update Profile Table instantly
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (dbError) throw dbError;

      // 5. Pass URL to parent to update UI
      onAvatarUpdate(publicUrl);
      
    } catch (error) {
      console.error('Upload Error:', error);
  alert(t('profile.photoUploadError'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center mt-2">
      <div 
        className="relative cursor-pointer group rounded-full overflow-hidden border-2 border-surface shadow-sm" 
        onClick={handleImageClick}
      >
        <img 
          src={displayUrl} 
          className={`w-28 h-28 object-cover transition-opacity ${isUploading ? 'opacity-50' : 'opacity-90'}`} 
          alt={t('profile.avatarAlt')}
        />
        
        {/* Overlay - Always visible with Camera Icon */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 transition-all">
          {isUploading ? (
            <Loader2 className="animate-spin text-white" size={28} />
          ) : (
            <Camera className="text-white opacity-100" size={28} />
          )}
        </div>
      </div>
      
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImageUpload} 
        accept="image/jpeg, image/png, image/webp" 
        className="hidden" 
      />
      <p className="text-xs mt-3 font-medium text-primary">
  {isUploading ? t('profile.uploading') : t('profile.tapToChangePhoto')}
      </p>
    </div>
  );
};

export default ProfileAvatarEdit;
