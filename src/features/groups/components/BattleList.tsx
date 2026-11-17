import React from 'react';
import { Clock, Swords, Users } from 'lucide-react';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import EmptyState from '@/shared/components/ui/EmptyState';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import type { Battle } from '../types';
import { deriveBattleState, secondsUntil } from '../utils/battleState';

type BattleListProps = {
  battles: Battle[];
  nowMs: number;
  isAdmin: boolean;
  onJoin: (battleId: string) => void;
  onOpen: (battleId: string) => void;
  onCancel: (battleId: string) => void;
  joiningId?: string | null;
};

const STATE_STYLE: Record<string, string> = {
  upcoming: 'bg-secondary text-text-secondary',
  live: 'bg-red-500/15 text-red-600',
  grading: 'bg-accent/20 text-primary',
  completed: 'bg-primary/10 text-primary',
  cancelled: 'bg-secondary text-text-secondary',
};

const formatClock = (seconds: number): string => {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

export const BattleList: React.FC<BattleListProps> = ({
  battles,
  nowMs,
  isAdmin,
  onJoin,
  onOpen,
  onCancel,
  joiningId,
}) => {
  const { language, t } = useLanguage();

  if (battles.length === 0) {
    return <EmptyState message={t('groups.noBattles')} />;
  }

  const stateLabel = (state: string): string => {
    switch (state) {
      case 'upcoming':
        return t('groups.upcoming');
      case 'live':
        return t('groups.live');
      case 'grading':
        return t('groups.grading');
      case 'completed':
        return t('groups.completed');
      case 'cancelled':
        return t('groups.cancelled');
      default:
        return t('groups.battle');
    }
  };

  return (
    <div className="space-y-3">
      {battles.map((battle) => {
        const state = deriveBattleState(battle, nowMs);
        const joined = Boolean(battle.my_participation);
        const submitted = battle.my_participation?.status === 'submitted';
        const canJoin = (state === 'upcoming' || state === 'live') && !joined;
        const canOpen = joined || state === 'grading' || state === 'completed';
        const countdown =
          state === 'upcoming'
            ? secondsUntil(battle.start_time, nowMs)
            : state === 'live'
              ? secondsUntil(battle.end_time, nowMs)
              : 0;

        return (
          <div
            key={battle.id}
            className="rounded-2xl border border-card-border bg-card-bg p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Swords className="h-4 w-4 text-primary" />
                  <h4 className="truncate text-sm font-bold text-text-primary">{battle.title}</h4>
                  <Badge className={STATE_STYLE[state] ?? STATE_STYLE.upcoming}>
                    {stateLabel(state)}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-text-secondary">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {localizeDigits(battle.participant_count ?? 0, language)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {localizeDigits(battle.duration_minutes, language)}m
                  </span>
                  {countdown > 0 && (
                    <span className="font-semibold text-primary">{formatClock(countdown)}</span>
                  )}
                </div>
              </div>

              <div className="flex flex-shrink-0 flex-col gap-2">
                {canJoin && (
                  <Button
                    size="sm"
                    onClick={() => onJoin(battle.id)}
                    isLoading={joiningId === battle.id}
                  >
                    {t('groups.joinBattle')}
                  </Button>
                )}
                {canOpen && !canJoin && (
                  <Button size="sm" variant={submitted ? 'secondary' : 'primary'} onClick={() => onOpen(battle.id)}>
                    {submitted ? t('groups.result') : t('groups.enterBattle')}
                  </Button>
                )}
                {isAdmin && (state === 'upcoming' || state === 'live') && (
                  <Button size="sm" variant="ghost" onClick={() => onCancel(battle.id)}>
                    {t('common.cancel')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BattleList;
