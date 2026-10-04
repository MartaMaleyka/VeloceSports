import { useState, useCallback } from 'react';
import type { MatchDto } from '@velocesport/shared';

export function useMatchModal() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MatchDto | null>(null);
  const [cancelTarget, setCancelTarget] = useState<MatchDto | null>(null);
  const [finishTarget, setFinishTarget] = useState<MatchDto | null>(null);
  const [statusActionLoading, setStatusActionLoading] = useState(false);

  const openCreateModal = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((match: MatchDto) => {
    setEditing(match);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
  }, []);

  const showCancelConfirm = useCallback((match: MatchDto) => {
    setCancelTarget(match);
  }, []);

  const showFinishConfirm = useCallback((match: MatchDto) => {
    setFinishTarget(match);
  }, []);

  const closeCancelConfirm = useCallback(() => {
    setCancelTarget(null);
  }, []);

  const closeFinishConfirm = useCallback(() => {
    setFinishTarget(null);
  }, []);

  return {
    modalOpen,
    editing,
    cancelTarget,
    finishTarget,
    statusActionLoading,
    setStatusActionLoading,
    openCreateModal,
    openEditModal,
    closeModal,
    showCancelConfirm,
    showFinishConfirm,
    closeCancelConfirm,
    closeFinishConfirm,
  };
}
