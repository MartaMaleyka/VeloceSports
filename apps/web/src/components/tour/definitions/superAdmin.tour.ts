import type { TranslationKey } from '@velocesport/i18n';
import type { TourDefinition } from '../types';
import type { PlatformPageId } from '../../../lib/platform-pages';

const homeTour: TourDefinition = [
  {
    target: 'home-hero',
    titleKey: 'tour.superAdmin.home.hero.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.home.hero.body' as TranslationKey,
  },
  {
    target: 'home-kpis',
    titleKey: 'tour.superAdmin.home.kpis.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.home.kpis.body' as TranslationKey,
  },
  {
    target: 'home-billing-summary',
    titleKey: 'tour.superAdmin.home.billing.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.home.billing.body' as TranslationKey,
  },
  {
    target: 'home-attention',
    titleKey: 'tour.superAdmin.home.attention.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.home.attention.body' as TranslationKey,
  },
  {
    target: 'home-quick-links',
    titleKey: 'tour.superAdmin.home.quickLinks.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.home.quickLinks.body' as TranslationKey,
  },
];

const invoicesListTour: TourDefinition = [
  {
    target: 'invoices-list-kpis',
    titleKey: 'tour.superAdmin.invoicesList.kpis.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.invoicesList.kpis.body' as TranslationKey,
  },
  {
    target: 'invoices-list-month-filter',
    titleKey: 'tour.superAdmin.invoicesList.monthFilter.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.invoicesList.monthFilter.body' as TranslationKey,
  },
  {
    target: 'invoices-list-process-overdue-button',
    titleKey: 'tour.superAdmin.invoicesList.processOverdue.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.invoicesList.processOverdue.body' as TranslationKey,
  },
  {
    target: 'invoices-list-create-button',
    titleKey: 'tour.superAdmin.invoicesList.create.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.invoicesList.create.body' as TranslationKey,
  },
];

const auditLogTour: TourDefinition = [
  {
    target: 'audit-log-kpis',
    titleKey: 'tour.superAdmin.auditLog.kpis.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.auditLog.kpis.body' as TranslationKey,
  },
  {
    target: 'audit-log-filters',
    titleKey: 'tour.superAdmin.auditLog.filters.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.auditLog.filters.body' as TranslationKey,
  },
  {
    target: 'audit-log-view-detail-button',
    titleKey: 'tour.superAdmin.auditLog.viewDetail.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.auditLog.viewDetail.body' as TranslationKey,
  },
];

const plansListTour: TourDefinition = [
  {
    target: 'plans-list-kpis',
    titleKey: 'tour.superAdmin.plansList.kpis.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.plansList.kpis.body' as TranslationKey,
  },
  {
    target: 'plans-list-plan-details',
    titleKey: 'tour.superAdmin.plansList.planDetails.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.plansList.planDetails.body' as TranslationKey,
  },
  {
    target: 'plans-list-create-button',
    titleKey: 'tour.superAdmin.plansList.create.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.plansList.create.body' as TranslationKey,
  },
  {
    target: 'plans-list-row-actions',
    titleKey: 'tour.superAdmin.plansList.rowActions.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.plansList.rowActions.body' as TranslationKey,
  },
];

const planFormTour: TourDefinition = [
  {
    target: 'plan-form-name-input',
    titleKey: 'tour.superAdmin.planForm.name.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.planForm.name.body' as TranslationKey,
  },
  {
    target: 'plan-form-pricing',
    titleKey: 'tour.superAdmin.planForm.pricing.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.planForm.pricing.body' as TranslationKey,
  },
  {
    target: 'plan-form-limits',
    titleKey: 'tour.superAdmin.planForm.limits.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.planForm.limits.body' as TranslationKey,
  },
  {
    target: 'plan-form-submit-button',
    titleKey: 'tour.superAdmin.planForm.submit.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.planForm.submit.body' as TranslationKey,
  },
];

const academiesListTour: TourDefinition = [
  {
    target: 'academies-list-kpis',
    titleKey: 'tour.superAdmin.academiesList.kpis.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.academiesList.kpis.body' as TranslationKey,
  },
  {
    target: 'academies-list-create-button',
    titleKey: 'tour.superAdmin.academiesList.create.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.academiesList.create.body' as TranslationKey,
  },
  {
    target: 'academies-list-row-actions',
    titleKey: 'tour.superAdmin.academiesList.rowActions.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.academiesList.rowActions.body' as TranslationKey,
  },
  {
    target: 'academies-list-billing-status',
    titleKey: 'tour.superAdmin.academiesList.billingStatus.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.academiesList.billingStatus.body' as TranslationKey,
  },
];

const academyFormTour: TourDefinition = [
  {
    target: 'academy-form-name-input',
    titleKey: 'tour.superAdmin.academyForm.name.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.academyForm.name.body' as TranslationKey,
  },
  {
    target: 'academy-form-plan-select',
    titleKey: 'tour.superAdmin.academyForm.plan.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.academyForm.plan.body' as TranslationKey,
  },
  {
    target: 'academy-form-billing-anchor',
    titleKey: 'tour.superAdmin.academyForm.billingAnchor.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.academyForm.billingAnchor.body' as TranslationKey,
  },
  {
    target: 'academy-form-submit-button',
    titleKey: 'tour.superAdmin.academyForm.submit.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.academyForm.submit.body' as TranslationKey,
  },
];

const academyDetailTour: TourDefinition = [
  {
    target: 'academy-detail-header',
    titleKey: 'tour.superAdmin.academyDetail.header.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.academyDetail.header.body' as TranslationKey,
  },
  {
    target: 'academy-detail-edit-button',
    titleKey: 'tour.superAdmin.academyDetail.edit.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.academyDetail.edit.body' as TranslationKey,
  },
  {
    target: 'academy-detail-user-kpis',
    titleKey: 'tour.superAdmin.academyDetail.userKpis.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.academyDetail.userKpis.body' as TranslationKey,
  },
  {
    target: 'academy-detail-create-user-form',
    titleKey: 'tour.superAdmin.academyDetail.createUser.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.academyDetail.createUser.body' as TranslationKey,
  },
];

const superAdminsTour: TourDefinition = [
  {
    target: 'super-admins-kpis',
    titleKey: 'tour.superAdmin.superAdmins.kpis.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.superAdmins.kpis.body' as TranslationKey,
  },
  {
    target: 'super-admins-create-form',
    titleKey: 'tour.superAdmin.superAdmins.createForm.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.superAdmins.createForm.body' as TranslationKey,
  },
  {
    target: 'super-admins-row-actions',
    titleKey: 'tour.superAdmin.superAdmins.rowActions.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.superAdmins.rowActions.body' as TranslationKey,
  },
];

const personalAccountsListTour: TourDefinition = [
  {
    target: 'personal-accounts-list-kpis',
    titleKey: 'tour.superAdmin.personalAccountsList.kpis.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.personalAccountsList.kpis.body' as TranslationKey,
  },
  {
    target: 'personal-accounts-list-account-info',
    titleKey: 'tour.superAdmin.personalAccountsList.accountInfo.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.personalAccountsList.accountInfo.body' as TranslationKey,
  },
  {
    target: 'personal-accounts-list-row-actions',
    titleKey: 'tour.superAdmin.personalAccountsList.rowActions.title' as TranslationKey,
    bodyKey: 'tour.superAdmin.personalAccountsList.rowActions.body' as TranslationKey,
  },
];

export const superAdminTours: Partial<Record<PlatformPageId, TourDefinition>> = {
  home: homeTour,
  'invoices-list': invoicesListTour,
  'audit-log': auditLogTour,
  'plans-list': plansListTour,
  'plan-form': planFormTour,
  'academies-list': academiesListTour,
  'academy-form': academyFormTour,
  'academy-detail': academyDetailTour,
  'super-admins': superAdminsTour,
  'personal-accounts-list': personalAccountsListTour,
};
