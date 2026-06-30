import type { Locale } from '@velocesport/i18n';
import type { SessionUser } from './auth-config';

declare module '*.svg?raw' {
  const content: string;
  export default content;
}

declare namespace App {
  interface Locals {
    session: SessionUser | null;
    locale: Locale;
  }
}
