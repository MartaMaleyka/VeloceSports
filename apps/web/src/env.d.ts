import type { Locale } from '@velocesport/i18n';
import type { SessionUser } from './auth-config';

declare namespace App {
  interface Locals {
    session: SessionUser | null;
    locale: Locale;
  }
}
