import React from 'react';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useStartModelPaper } from '../hooks/useStartModelPaper';
import type { ModelPaperListItem } from '../services/modelPaperService';
import PaperDetailsSheet from './PaperDetailsSheet';

interface PaperLauncherProps {
  paper: ModelPaperListItem | null;
  onClose: () => void;
}

const PaperLauncher: React.FC<PaperLauncherProps> = ({ paper, onClose }) => {
  const { t } = useLanguage();
  const startMutation = useStartModelPaper();

  return (
    <>
      {startMutation.isPending && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-app/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-2xl bg-card-bg px-4 py-3 text-sm font-semibold text-text-primary">
            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
            {t('exam.starting')}
          </div>
        </div>
      )}

      {paper && (
        <PaperDetailsSheet
          paper={paper}
          isStarting={startMutation.isPending}
          onClose={onClose}
          onStart={(selected) => startMutation.mutate(selected)}
        />
      )}
    </>
  );
};

export default PaperLauncher;
