import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  Select,
  Alert,
  cn,
  Skeleton,
} from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import {
  X,
  Check,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { TenantApiError, tenantFetch } from '../../lib/tenant-api';

interface Match {
  id: number;
  opponent: string;
  status: 'scheduled' | 'in_progress' | 'finished' | 'cancelled';
  periods_count: number;
  period_duration_minutes: number;
}

interface ActionCatalog {
  id: number;
  code: number;
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  notifiable: number;
}

interface GameAction {
  id: number;
  player_id: number;
  action_code: number;
  minute: number;
  period: number;
  created_at: string;
}

interface CaptureFormData {
  player_id: number;
  action_code: number;
  minute: number;
  period: number;
}

export function CoachMatchCaptureBroad({ matchId }: { matchId: number }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [match, setMatch] = useState<Match | null>(null);
  const [actions, setActions] = useState<ActionCatalog[]>([]);
  const [gameActions, setGameActions] = useState<GameAction[]>([]);

  const [formData, setFormData] = useState<CaptureFormData>({
    player_id: 0,
    action_code: 0,
    minute: 0,
    period: 1,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [matchData, actionsData, gameActionsData] = await Promise.all([
        tenantFetch<Match>(`matches/${matchId}`),
        tenantFetch<ActionCatalog[]>('action-catalog/active'),
        tenantFetch<GameAction[]>(`matches/${matchId}/actions`),
      ]);
      setMatch(matchData);
      setActions(actionsData);
      setGameActions(gameActionsData);
    } catch (e) {
      setError(e instanceof TenantApiError ? e.message : 'Failed to load match data');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (!formData.player_id || !formData.action_code) {
        throw new Error('Player and action are required');
      }

      await tenantFetch(`matches/${matchId}/actions`, {
        method: 'POST',
        body: JSON.stringify({
          player_id: formData.player_id,
          action_code: formData.action_code,
          minute: formData.minute,
          period: formData.period,
        }),
      });

      setSuccessMessage('Action captured successfully');
      setFormData({
        player_id: 0,
        action_code: 0,
        minute: formData.minute,
        period: formData.period,
      });

      await load();
    } catch (e) {
      setError(e instanceof TenantApiError ? e.message : 'Failed to capture action');
    } finally {
      setSubmitting(false);
    }
  };

  const actionName = useMemo(() => {
    const action = actions.find((a) => a.code === formData.action_code);
    return action?.name || '';
  }, [formData.action_code, actions]);

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'positive':
        return 'text-feedback-success';
      case 'negative':
        return 'text-feedback-error';
      default:
        return 'text-feedback-warning';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 animate-pulse rounded-lg" />
        <Skeleton className="h-96 animate-pulse rounded-lg" />
        <Skeleton className="h-96 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!match || match.status !== 'in_progress') {
    return (
      <Alert variant="warning" className="rounded-lg">
        <AlertCircle className="h-5 w-5" />
        <span>Match must be in progress to capture actions</span>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Match Header */}
      <div className="rounded-lg border border-border bg-bg-surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-text-primary">
              Live Match Capture: {match.opponent}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Period <span className="font-semibold">{formData.period}</span> of{' '}
              <span className="font-semibold">{match.periods_count}</span>
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-section-brand-subtle">
            <Activity className="h-6 w-6 text-section-brand-fg" />
          </div>
        </div>
      </div>

      {/* Action Capture Form */}
      <form onSubmit={handleSubmitAction} className="space-y-4 rounded-lg border border-border bg-bg-surface p-6">
        <h3 className="font-semibold text-text-primary">Capture Action</h3>

        {error && (
          <Alert variant="error">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </Alert>
        )}

        {successMessage && (
          <Alert variant="success">
            <Check className="h-5 w-5" />
            <span>{successMessage}</span>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-text-primary">Player #</label>
            <Input
              type="number"
              min="1"
              max="99"
              value={formData.player_id || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  player_id: e.target.value ? parseInt(e.target.value, 10) : 0,
                })
              }
              placeholder="Jersey number"
              className="mt-1"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary">Action</label>
            <Select
              value={formData.action_code?.toString() || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  action_code: e.target.value ? parseInt(e.target.value, 10) : 0,
                })
              }
              className="mt-1"
              disabled={submitting}
            >
              <option value="">Select action</option>
              {actions.map((action) => (
                <option key={action.code} value={action.code}>
                  {action.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary">Minute</label>
            <Input
              type="number"
              min="0"
              max="999"
              value={formData.minute}
              onChange={(e) =>
                setFormData({ ...formData, minute: parseInt(e.target.value, 10) || 0 })
              }
              className="mt-1"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary">Period</label>
            <Select
              value={formData.period?.toString() || '1'}
              onChange={(e) =>
                setFormData({ ...formData, period: parseInt(e.target.value, 10) })
              }
              className="mt-1"
              disabled={submitting}
            >
              {Array.from({ length: match.periods_count }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  Period {i + 1}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {actionName && (
          <div className="rounded bg-bg-muted p-3">
            <p className="text-sm text-text-secondary">
              Capturing: <span className="font-semibold text-text-primary">{actionName}</span>
            </p>
          </div>
        )}

        <Button type="submit" disabled={submitting || !formData.player_id || !formData.action_code}>
          {submitting ? 'Recording...' : 'Record Action'}
        </Button>
      </form>

      {/* Actions Log */}
      <div className="rounded-lg border border-border bg-bg-surface p-6">
        <h3 className="mb-4 font-semibold text-text-primary">
          Actions Log ({gameActions.length})
        </h3>
        {gameActions.length === 0 ? (
          <p className="text-sm text-text-muted">No actions recorded yet</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {gameActions.map((action) => {
              const actionCatalog = actions.find((a) => a.code === action.action_code);
              return (
                <div
                  key={action.id}
                  className="flex items-center justify-between border-b border-border pb-2 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-text-secondary">#{action.player_id}</span>
                    <div>
                      <p className={cn('text-sm font-semibold', getImpactColor(actionCatalog?.impact || 'neutral'))}>
                        {actionCatalog?.name || `Action ${action.action_code}`}
                      </p>
                      <p className="text-xs text-text-secondary">
                        P{action.period} · {action.minute}'
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-text-muted">
                    {new Date(action.created_at).toLocaleTimeString()}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
