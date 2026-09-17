import type { TourDefinition } from '../types';
import type { TranslationKey } from '@velocesport/i18n';
import type { ParentPageId } from '../../../lib/parent-pages';
import { sharedMatchReportCardTour } from './shared.tour';

const parentHomeTour: TourDefinition = [
  {
    target: 'home-hero',
    titleKey: 'tour.parent.home.hero.title' as TranslationKey,
    bodyKey: 'tour.parent.home.hero.body' as TranslationKey,
  },
  {
    target: 'home-child-tabs',
    titleKey: 'tour.parent.home.childTabs.title' as TranslationKey,
    bodyKey: 'tour.parent.home.childTabs.body' as TranslationKey,
  },
  {
    target: 'home-period-filter',
    titleKey: 'tour.parent.home.periodFilter.title' as TranslationKey,
    bodyKey: 'tour.parent.home.periodFilter.body' as TranslationKey,
  },
  {
    target: 'home-dashboard-panel',
    titleKey: 'tour.parent.home.dashboardPanel.title' as TranslationKey,
    bodyKey: 'tour.parent.home.dashboardPanel.body' as TranslationKey,
  },
];

const parentCalendarTour: TourDefinition = [
  {
    target: 'calendar-overview',
    titleKey: 'tour.parent.calendar.overview.title' as TranslationKey,
    bodyKey: 'tour.parent.calendar.overview.body' as TranslationKey,
  },
];

const parentNotificationsTour: TourDefinition = [
  {
    target: 'notifications-page',
    titleKey: 'tour.parent.notifications.page.title' as TranslationKey,
    bodyKey: 'tour.parent.notifications.page.body' as TranslationKey,
  },
  {
    target: 'notifications-global-toggle',
    titleKey: 'tour.parent.notifications.globalToggle.title' as TranslationKey,
    bodyKey: 'tour.parent.notifications.globalToggle.body' as TranslationKey,
  },
  {
    target: 'notifications-email-note',
    titleKey: 'tour.parent.notifications.emailNote.title' as TranslationKey,
    bodyKey: 'tour.parent.notifications.emailNote.body' as TranslationKey,
  },
];

const parentChildrenTour: TourDefinition = [
  {
    target: 'children-page',
    titleKey: 'tour.parent.children.page.title' as TranslationKey,
    bodyKey: 'tour.parent.children.page.body' as TranslationKey,
  },
  {
    target: 'children-list',
    titleKey: 'tour.parent.children.list.title' as TranslationKey,
    bodyKey: 'tour.parent.children.list.body' as TranslationKey,
  },
];

const parentChildMatchesTour: TourDefinition = [
  {
    target: 'childMatches-back',
    titleKey: 'tour.parent.childMatches.back.title' as TranslationKey,
    bodyKey: 'tour.parent.childMatches.back.body' as TranslationKey,
  },
  {
    target: 'childMatches-list',
    titleKey: 'tour.parent.childMatches.list.title' as TranslationKey,
    bodyKey: 'tour.parent.childMatches.list.body' as TranslationKey,
  },
];

export const parentTours: Partial<Record<ParentPageId, TourDefinition>> = {
  home: parentHomeTour,
  calendar: parentCalendarTour,
  notifications: parentNotificationsTour,
  children: parentChildrenTour,
  childMatches: parentChildMatchesTour,
  matchReportCard: sharedMatchReportCardTour,
};
