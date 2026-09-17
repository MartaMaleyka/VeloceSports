import type { TranslationKey } from '@velocesport/i18n';
import type { TourDefinition } from '../types';

/**
 * Tours de pantallas cuyo componente se reutiliza entre roles (mismo DOM,
 * mismos data-tour). Cada archivo de tour por rol importa el que le aplique
 * y lo asigna a su pageId correspondiente, en vez de duplicar los pasos.
 */

// Lista de partidos — TenantMatchesPage.tsx (academy_admin, coach)
export const sharedMatchesListTour: TourDefinition = [
  {
    target: 'matches-list-kpis',
    titleKey: 'tour.shared.matchesList.kpis.title' as TranslationKey,
    bodyKey: 'tour.shared.matchesList.kpis.body' as TranslationKey,
  },
  {
    target: 'matches-list-search',
    titleKey: 'tour.shared.matchesList.search.title' as TranslationKey,
    bodyKey: 'tour.shared.matchesList.search.body' as TranslationKey,
  },
  {
    target: 'matches-list-status-filter',
    titleKey: 'tour.shared.matchesList.statusFilter.title' as TranslationKey,
    bodyKey: 'tour.shared.matchesList.statusFilter.body' as TranslationKey,
  },
  {
    target: 'matches-list-category-filter',
    titleKey: 'tour.shared.matchesList.categoryFilter.title' as TranslationKey,
    bodyKey: 'tour.shared.matchesList.categoryFilter.body' as TranslationKey,
  },
  {
    target: 'matches-list-create-button',
    titleKey: 'tour.shared.matchesList.createButton.title' as TranslationKey,
    bodyKey: 'tour.shared.matchesList.createButton.body' as TranslationKey,
  },
];

// Detalle/captura de partido — MatchDetailPage.tsx + MatchCapturePanel.tsx
// (academy_admin, coach)
export const sharedMatchDetailTour: TourDefinition = [
  {
    target: 'match-detail-header',
    titleKey: 'tour.shared.matchDetail.header.title' as TranslationKey,
    bodyKey: 'tour.shared.matchDetail.header.body' as TranslationKey,
  },
  {
    target: 'match-detail-summary',
    titleKey: 'tour.shared.matchDetail.summary.title' as TranslationKey,
    bodyKey: 'tour.shared.matchDetail.summary.body' as TranslationKey,
  },
  {
    target: 'match-detail-capture-clock',
    titleKey: 'tour.shared.matchDetail.clock.title' as TranslationKey,
    bodyKey: 'tour.shared.matchDetail.clock.body' as TranslationKey,
  },
  {
    target: 'match-detail-capture-players',
    titleKey: 'tour.shared.matchDetail.players.title' as TranslationKey,
    bodyKey: 'tour.shared.matchDetail.players.body' as TranslationKey,
  },
  {
    target: 'match-detail-capture-actions',
    titleKey: 'tour.shared.matchDetail.actions.title' as TranslationKey,
    bodyKey: 'tour.shared.matchDetail.actions.body' as TranslationKey,
  },
  {
    target: 'match-detail-capture-last-play',
    titleKey: 'tour.shared.matchDetail.lastPlay.title' as TranslationKey,
    bodyKey: 'tour.shared.matchDetail.lastPlay.body' as TranslationKey,
  },
  {
    target: 'match-detail-capture-voice',
    titleKey: 'tour.shared.matchDetail.voice.title' as TranslationKey,
    bodyKey: 'tour.shared.matchDetail.voice.body' as TranslationKey,
  },
];

// Reporte/ficha de partido de un jugador — PlayerMatchReportPage.tsx
// (academy_admin, coach, parent, player)
export const sharedMatchReportCardTour: TourDefinition = [
  {
    target: 'report-card-header',
    titleKey: 'tour.shared.matchReportCard.header.title' as TranslationKey,
    bodyKey: 'tour.shared.matchReportCard.header.body' as TranslationKey,
  },
  {
    target: 'report-card-chart',
    titleKey: 'tour.shared.matchReportCard.chart.title' as TranslationKey,
    bodyKey: 'tour.shared.matchReportCard.chart.body' as TranslationKey,
  },
  {
    target: 'report-card-motivation',
    titleKey: 'tour.shared.matchReportCard.motivation.title' as TranslationKey,
    bodyKey: 'tour.shared.matchReportCard.motivation.body' as TranslationKey,
  },
  {
    target: 'report-card-footer',
    titleKey: 'tour.shared.matchReportCard.footer.title' as TranslationKey,
    bodyKey: 'tour.shared.matchReportCard.footer.body' as TranslationKey,
  },
  {
    target: 'report-card-observations',
    titleKey: 'tour.shared.matchReportCard.observations.title' as TranslationKey,
    bodyKey: 'tour.shared.matchReportCard.observations.body' as TranslationKey,
  },
];
