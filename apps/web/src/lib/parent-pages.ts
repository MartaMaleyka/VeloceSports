import type { ComponentType } from 'react';
import ParentChildrenPage from '../components/parent/ParentChildrenPage';

export const parentPages = {
  children: ParentChildrenPage,
} as const satisfies Record<string, ComponentType<Record<string, unknown>>>;

export type ParentPageId = keyof typeof parentPages;

export function resolveParentPage(pageId: ParentPageId | undefined) {
  if (!pageId) return null;
  return parentPages[pageId] ?? null;
}
