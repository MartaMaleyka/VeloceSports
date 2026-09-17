import type { TourDefinition } from '../types';
import type { TranslationKey } from '@velocesport/i18n';
import type { AcademyPageId } from '../../../lib/academy-pages';
import {
  sharedMatchesListTour,
  sharedMatchDetailTour,
  sharedMatchReportCardTour,
} from './shared.tour';

const homeTour: TourDefinition = [
  {
    target: 'home-hero',
    titleKey: 'tour.academyAdmin.home.hero.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.home.hero.body' as TranslationKey,
  },
  {
    target: 'home-kpis',
    titleKey: 'tour.academyAdmin.home.kpis.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.home.kpis.body' as TranslationKey,
  },
  {
    target: 'home-attention',
    titleKey: 'tour.academyAdmin.home.attention.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.home.attention.body' as TranslationKey,
  },
  {
    target: 'home-quick-links',
    titleKey: 'tour.academyAdmin.home.quickLinks.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.home.quickLinks.body' as TranslationKey,
  },
];

const billingTour: TourDefinition = [
  {
    target: 'billing-plan-summary',
    titleKey: 'tour.academyAdmin.billing.planSummary.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.billing.planSummary.body' as TranslationKey,
  },
  {
    target: 'billing-period-info',
    titleKey: 'tour.academyAdmin.billing.periodInfo.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.billing.periodInfo.body' as TranslationKey,
  },
  {
    target: 'billing-invoices-list',
    titleKey: 'tour.academyAdmin.billing.invoicesList.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.billing.invoicesList.body' as TranslationKey,
  },
];

const usersTour: TourDefinition = [
  {
    target: 'users-kpis',
    titleKey: 'tour.academyAdmin.users.kpis.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.users.kpis.body' as TranslationKey,
  },
  {
    target: 'users-create-button',
    titleKey: 'tour.academyAdmin.users.create.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.users.create.body' as TranslationKey,
  },
  {
    target: 'users-list',
    titleKey: 'tour.academyAdmin.users.list.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.users.list.body' as TranslationKey,
  },
];

const categoriesTour: TourDefinition = [
  {
    target: 'categories-kpis',
    titleKey: 'tour.academyAdmin.categories.kpis.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.categories.kpis.body' as TranslationKey,
  },
  {
    target: 'categories-create-button',
    titleKey: 'tour.academyAdmin.categories.create.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.categories.create.body' as TranslationKey,
  },
  {
    target: 'categories-list',
    titleKey: 'tour.academyAdmin.categories.list.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.categories.list.body' as TranslationKey,
  },
];

const actionsTour: TourDefinition = [
  {
    target: 'actions-kpis',
    titleKey: 'tour.academyAdmin.actions.kpis.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.actions.kpis.body' as TranslationKey,
  },
  {
    target: 'actions-create-button',
    titleKey: 'tour.academyAdmin.actions.create.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.actions.create.body' as TranslationKey,
  },
  {
    target: 'actions-list',
    titleKey: 'tour.academyAdmin.actions.list.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.actions.list.body' as TranslationKey,
  },
];

const playersTour: TourDefinition = [
  {
    target: 'players-kpis',
    titleKey: 'tour.academyAdmin.players.kpis.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.players.kpis.body' as TranslationKey,
  },
  {
    target: 'players-create-button',
    titleKey: 'tour.academyAdmin.players.create.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.players.create.body' as TranslationKey,
  },
  {
    target: 'players-list',
    titleKey: 'tour.academyAdmin.players.list.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.players.list.body' as TranslationKey,
  },
];

const settingsTour: TourDefinition = [
  {
    target: 'settings-profile-section',
    titleKey: 'tour.academyAdmin.settings.profile.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.settings.profile.body' as TranslationKey,
  },
  {
    target: 'settings-regional-section',
    titleKey: 'tour.academyAdmin.settings.regional.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.settings.regional.body' as TranslationKey,
  },
  {
    target: 'settings-notifications-toggle',
    titleKey: 'tour.academyAdmin.settings.notifications.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.settings.notifications.body' as TranslationKey,
  },
  {
    target: 'settings-readonly-section',
    titleKey: 'tour.academyAdmin.settings.readonly.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.settings.readonly.body' as TranslationKey,
  },
];

const reportsTour: TourDefinition = [
  {
    target: 'reports-hint',
    titleKey: 'tour.academyAdmin.reports.hint.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.reports.hint.body' as TranslationKey,
  },
  {
    target: 'reports-cards-grid',
    titleKey: 'tour.academyAdmin.reports.cardsGrid.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.reports.cardsGrid.body' as TranslationKey,
  },
  {
    target: 'reports-export-pdf-button',
    titleKey: 'tour.academyAdmin.reports.exportPdf.title' as TranslationKey,
    bodyKey: 'tour.academyAdmin.reports.exportPdf.body' as TranslationKey,
  },
];

export const academyAdminTours: Partial<Record<AcademyPageId, TourDefinition>> = {
  home: homeTour,
  billing: billingTour,
  users: usersTour,
  categories: categoriesTour,
  actions: actionsTour,
  players: playersTour,
  matches: sharedMatchesListTour,
  matchDetail: sharedMatchDetailTour,
  matchReportCard: sharedMatchReportCardTour,
  settings: settingsTour,
  reports: reportsTour,
};
