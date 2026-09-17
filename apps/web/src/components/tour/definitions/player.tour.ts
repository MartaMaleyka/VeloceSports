import type { TourDefinition } from '../types';
import type { PlayerPageId } from '../../../lib/player-pages';
import type { TranslationKey } from '@velocesport/i18n';
import { sharedMatchReportCardTour } from './shared.tour';

const playerHomeTour: TourDefinition = [
  {
    target: 'home-hero',
    titleKey: 'tour.player.home.hero.title' as TranslationKey,
    bodyKey: 'tour.player.home.hero.body' as TranslationKey,
  },
  {
    target: 'home-go-profile',
    titleKey: 'tour.player.home.goProfile.title' as TranslationKey,
    bodyKey: 'tour.player.home.goProfile.body' as TranslationKey,
  },
  {
    target: 'home-go-matches',
    titleKey: 'tour.player.home.goMatches.title' as TranslationKey,
    bodyKey: 'tour.player.home.goMatches.body' as TranslationKey,
  },
  {
    target: 'home-go-reports',
    titleKey: 'tour.player.home.goReports.title' as TranslationKey,
    bodyKey: 'tour.player.home.goReports.body' as TranslationKey,
  },
];

const playerProfileTour: TourDefinition = [
  {
    target: 'profile-avatar',
    titleKey: 'tour.player.profile.avatar.title' as TranslationKey,
    bodyKey: 'tour.player.profile.avatar.body' as TranslationKey,
  },
  {
    target: 'profile-info',
    titleKey: 'tour.player.profile.info.title' as TranslationKey,
    bodyKey: 'tour.player.profile.info.body' as TranslationKey,
  },
  {
    target: 'profile-edit-form',
    titleKey: 'tour.player.profile.editForm.title' as TranslationKey,
    bodyKey: 'tour.player.profile.editForm.body' as TranslationKey,
  },
  {
    target: 'profile-save',
    titleKey: 'tour.player.profile.save.title' as TranslationKey,
    bodyKey: 'tour.player.profile.save.body' as TranslationKey,
  },
];

const playerMatchesTour: TourDefinition = [
  {
    target: 'matches-list',
    titleKey: 'tour.player.matches.list.title' as TranslationKey,
    bodyKey: 'tour.player.matches.list.body' as TranslationKey,
  },
  {
    target: 'matches-view-report',
    titleKey: 'tour.player.matches.viewReport.title' as TranslationKey,
    bodyKey: 'tour.player.matches.viewReport.body' as TranslationKey,
  },
];

const playerCalendarTour: TourDefinition = [
  {
    target: 'calendar-root',
    titleKey: 'tour.player.calendar.root.title' as TranslationKey,
    bodyKey: 'tour.player.calendar.root.body' as TranslationKey,
  },
  {
    target: 'calendar-tabs',
    titleKey: 'tour.player.calendar.tabs.title' as TranslationKey,
    bodyKey: 'tour.player.calendar.tabs.body' as TranslationKey,
  },
  {
    target: 'calendar-relative-label',
    titleKey: 'tour.player.calendar.relativeLabel.title' as TranslationKey,
    bodyKey: 'tour.player.calendar.relativeLabel.body' as TranslationKey,
  },
];

const playerReportsTour: TourDefinition = [
  {
    target: 'reports-intro',
    titleKey: 'tour.player.reports.intro.title' as TranslationKey,
    bodyKey: 'tour.player.reports.intro.body' as TranslationKey,
  },
  {
    target: 'reports-observations',
    titleKey: 'tour.player.reports.observations.title' as TranslationKey,
    bodyKey: 'tour.player.reports.observations.body' as TranslationKey,
  },
];

export const playerTours: Partial<Record<PlayerPageId, TourDefinition>> = {
  home: playerHomeTour,
  profile: playerProfileTour,
  matches: playerMatchesTour,
  calendar: playerCalendarTour,
  reports: playerReportsTour,
  matchReportCard: sharedMatchReportCardTour,
};
