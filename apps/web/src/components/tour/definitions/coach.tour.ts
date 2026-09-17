import type { TourDefinition } from '../types';
import type { TranslationKey } from '@velocesport/i18n';
import type { CoachPageId } from '../../../lib/coach-pages';
import {
  sharedMatchesListTour,
  sharedMatchDetailTour,
  sharedMatchReportCardTour,
} from './shared.tour';

const coachHomeTour: TourDefinition = [
  {
    target: 'home-hero',
    titleKey: 'tour.coach.home.hero.title' as TranslationKey,
    bodyKey: 'tour.coach.home.hero.body' as TranslationKey,
  },
  {
    target: 'home-kpis',
    titleKey: 'tour.coach.home.kpis.title' as TranslationKey,
    bodyKey: 'tour.coach.home.kpis.body' as TranslationKey,
  },
  {
    target: 'home-attention',
    titleKey: 'tour.coach.home.attention.title' as TranslationKey,
    bodyKey: 'tour.coach.home.attention.body' as TranslationKey,
  },
  {
    target: 'home-quick-links',
    titleKey: 'tour.coach.home.quickLinks.title' as TranslationKey,
    bodyKey: 'tour.coach.home.quickLinks.body' as TranslationKey,
  },
];

const coachCategoriesTour: TourDefinition = [
  {
    target: 'categories-grid',
    titleKey: 'tour.coach.categories.grid.title' as TranslationKey,
    bodyKey: 'tour.coach.categories.grid.body' as TranslationKey,
  },
  {
    target: 'categories-card',
    titleKey: 'tour.coach.categories.card.title' as TranslationKey,
    bodyKey: 'tour.coach.categories.card.body' as TranslationKey,
  },
  {
    target: 'categories-player-count',
    titleKey: 'tour.coach.categories.playerCount.title' as TranslationKey,
    bodyKey: 'tour.coach.categories.playerCount.body' as TranslationKey,
  },
];

const coachPlayersTour: TourDefinition = [
  {
    target: 'players-category-filter',
    titleKey: 'tour.coach.players.categoryFilter.title' as TranslationKey,
    bodyKey: 'tour.coach.players.categoryFilter.body' as TranslationKey,
  },
  {
    target: 'players-grid',
    titleKey: 'tour.coach.players.grid.title' as TranslationKey,
    bodyKey: 'tour.coach.players.grid.body' as TranslationKey,
  },
  {
    target: 'players-card',
    titleKey: 'tour.coach.players.card.title' as TranslationKey,
    bodyKey: 'tour.coach.players.card.body' as TranslationKey,
  },
  {
    target: 'players-view-matches',
    titleKey: 'tour.coach.players.viewMatches.title' as TranslationKey,
    bodyKey: 'tour.coach.players.viewMatches.body' as TranslationKey,
  },
];

const coachAnalysisTour: TourDefinition = [
  {
    target: 'analysis-filters',
    titleKey: 'tour.coach.analysis.filters.title' as TranslationKey,
    bodyKey: 'tour.coach.analysis.filters.body' as TranslationKey,
  },
  {
    target: 'analysis-summary',
    titleKey: 'tour.coach.analysis.summary.title' as TranslationKey,
    bodyKey: 'tour.coach.analysis.summary.body' as TranslationKey,
  },
  {
    target: 'analysis-actions',
    titleKey: 'tour.coach.analysis.actions.title' as TranslationKey,
    bodyKey: 'tour.coach.analysis.actions.body' as TranslationKey,
  },
  {
    target: 'analysis-chart',
    titleKey: 'tour.coach.analysis.chart.title' as TranslationKey,
    bodyKey: 'tour.coach.analysis.chart.body' as TranslationKey,
  },
  {
    target: 'analysis-player-list',
    titleKey: 'tour.coach.analysis.playerList.title' as TranslationKey,
    bodyKey: 'tour.coach.analysis.playerList.body' as TranslationKey,
  },
];

const coachAnalysisPlayerDetailTour: TourDefinition = [
  {
    target: 'analysisDetail-back',
    titleKey: 'tour.coach.analysisPlayerDetail.back.title' as TranslationKey,
    bodyKey: 'tour.coach.analysisPlayerDetail.back.body' as TranslationKey,
  },
  {
    target: 'analysisDetail-header',
    titleKey: 'tour.coach.analysisPlayerDetail.header.title' as TranslationKey,
    bodyKey: 'tour.coach.analysisPlayerDetail.header.body' as TranslationKey,
  },
  {
    target: 'analysisDetail-stats',
    titleKey: 'tour.coach.analysisPlayerDetail.stats.title' as TranslationKey,
    bodyKey: 'tour.coach.analysisPlayerDetail.stats.body' as TranslationKey,
  },
  {
    target: 'analysisDetail-matches',
    titleKey: 'tour.coach.analysisPlayerDetail.matches.title' as TranslationKey,
    bodyKey: 'tour.coach.analysisPlayerDetail.matches.body' as TranslationKey,
  },
  {
    target: 'analysisDetail-observations',
    titleKey: 'tour.coach.analysisPlayerDetail.observations.title' as TranslationKey,
    bodyKey: 'tour.coach.analysisPlayerDetail.observations.body' as TranslationKey,
  },
];

export const coachTours: Partial<Record<CoachPageId, TourDefinition>> = {
  home: coachHomeTour,
  categories: coachCategoriesTour,
  players: coachPlayersTour,
  matches: sharedMatchesListTour,
  matchDetail: sharedMatchDetailTour,
  matchReportCard: sharedMatchReportCardTour,
  analysis: coachAnalysisTour,
  analysisPlayerDetail: coachAnalysisPlayerDetailTour,
};
