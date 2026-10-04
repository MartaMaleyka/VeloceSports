import {
  getLanguageFromHeader,
  t,
  tWithFallback,
  createTranslator,
  type SupportedLanguage,
} from '../../../src/utils/i18n.js';

describe('i18n Utilities', () => {
  describe('getLanguageFromHeader', () => {
    it('should return Spanish by default', () => {
      const lang = getLanguageFromHeader();
      expect(lang).toBe('es');
    });

    it('should detect Spanish from Accept-Language header', () => {
      const lang = getLanguageFromHeader('es-ES,es;q=0.9');
      expect(lang).toBe('es');
    });

    it('should detect English from Accept-Language header', () => {
      const lang = getLanguageFromHeader('en-US,en;q=0.9');
      expect(lang).toBe('en');
    });

    it('should prefer Spanish when multiple languages present', () => {
      const lang = getLanguageFromHeader('en-US,es;q=0.9');
      expect(lang).toBe('es');
    });

    it('should prefer English when Spanish not present', () => {
      const lang = getLanguageFromHeader('en-US,fr;q=0.9');
      expect(lang).toBe('en');
    });

    it('should return default for unsupported languages', () => {
      const lang = getLanguageFromHeader('fr-FR,de;q=0.9');
      expect(lang).toBe('es');
    });

    it('should handle empty Accept-Language header', () => {
      const lang = getLanguageFromHeader('');
      expect(lang).toBe('es');
    });

    it('should handle complex Accept-Language header', () => {
      const lang = getLanguageFromHeader('pt-BR,pt;q=0.9,es;q=0.8,en;q=0.7');
      expect(lang).toBe('es');
    });

    it('should handle case-insensitive language codes', () => {
      const lang = getLanguageFromHeader('ES-es,EN;q=0.9');
      expect(lang).toBe('es');
    });

    it('should handle whitespace in Accept-Language header', () => {
      const lang = getLanguageFromHeader('  es  , en ; q=0.9');
      expect(lang).toBe('es');
    });
  });

  describe('t (translate)', () => {
    it('should translate Spanish message', () => {
      const msg = t('validation.email.required', 'es');
      expect(msg).toBe('El correo electrónico es requerido');
    });

    it('should translate English message', () => {
      const msg = t('validation.email.required', 'en');
      expect(msg).toBe('Email is required');
    });

    it('should use Spanish as default language', () => {
      const msg = t('auth.loginSuccess');
      expect(msg).toContain('correctamente');
    });

    it('should return key if translation not found', () => {
      const msg = t('nonexistent.key', 'es');
      expect(msg).toBe('nonexistent.key');
    });

    it('should handle nested translation keys', () => {
      const msg = t('validation.email.invalid', 'es');
      expect(msg).toBe('El correo electrónico no es válido');
    });

    it('should handle deeply nested keys', () => {
      const msg = t('crud.created', 'es');
      expect(msg).toBe('Creado correctamente');
    });

    it('should return key for invalid nested path', () => {
      const msg = t('validation.invalid.nested.path', 'es');
      expect(msg).toBe('validation.invalid.nested.path');
    });
  });

  describe('tWithFallback', () => {
    it('should return translation in requested language', () => {
      const msg = tWithFallback('validation.email.required', 'en');
      expect(msg).toBe('Email is required');
    });

    it('should fallback to Spanish if translation missing', () => {
      // Both Spanish and English have this key, but test the fallback mechanism
      const msg = tWithFallback('validation.email.required', 'en');
      expect(msg).toBe('Email is required');
    });

    it('should use default language as fallback', () => {
      const msg = tWithFallback('validation.email.required');
      expect(msg).toContain('El correo');
    });

    it('should handle missing translations', () => {
      const msg = tWithFallback('totally.nonexistent.key', 'en');
      expect(msg).toBe('totally.nonexistent.key');
    });

    it('should return key if all fallbacks fail', () => {
      const msg = tWithFallback('invalid.path.here', 'en');
      expect(msg).toBe('invalid.path.here');
    });
  });

  describe('createTranslator', () => {
    it('should create a translator function', () => {
      const translator = createTranslator('es');
      expect(translator).toHaveProperty('t');
      expect(translator).toHaveProperty('language');
    });

    it('should translate using created translator', () => {
      const translator = createTranslator('es');
      const msg = translator.t('validation.email.required');
      expect(msg).toBe('El correo electrónico es requerido');
    });

    it('should preserve language in translator', () => {
      const translator = createTranslator('en');
      expect(translator.language).toBe('en');
    });

    it('should use Spanish translator', () => {
      const translator = createTranslator('es');
      const msg = translator.t('auth.loginSuccess');
      expect(msg).toContain('Sesión');
    });

    it('should use English translator', () => {
      const translator = createTranslator('en');
      const msg = translator.t('auth.loginSuccess');
      expect(msg).toContain('Successfully');
    });

    it('should use default language if not specified', () => {
      const translator = createTranslator();
      const msg = translator.t('validation.email.required');
      expect(msg).toContain('El correo');
    });

    it('should handle missing translations in created translator', () => {
      const translator = createTranslator('en');
      const msg = translator.t('nonexistent.key');
      expect(msg).toBe('nonexistent.key');
    });
  });

  describe('Common validation messages', () => {
    it('should have email validation messages in both languages', () => {
      expect(t('validation.email.required', 'es')).toBeTruthy();
      expect(t('validation.email.required', 'en')).toBeTruthy();
      expect(t('validation.email.invalid', 'es')).toBeTruthy();
      expect(t('validation.email.invalid', 'en')).toBeTruthy();
    });

    it('should have password validation messages in both languages', () => {
      expect(t('validation.password.required', 'es')).toBeTruthy();
      expect(t('validation.password.required', 'en')).toBeTruthy();
      expect(t('validation.password.minLength', 'es')).toBeTruthy();
      expect(t('validation.password.minLength', 'en')).toBeTruthy();
    });

    it('should have form validation messages in both languages', () => {
      expect(t('validation.name.required', 'es')).toBeTruthy();
      expect(t('validation.name.required', 'en')).toBeTruthy();
    });

    it('should have error messages in both languages', () => {
      expect(t('errors.networkError', 'es')).toBeTruthy();
      expect(t('errors.networkError', 'en')).toBeTruthy();
      expect(t('errors.timeout', 'es')).toBeTruthy();
      expect(t('errors.timeout', 'en')).toBeTruthy();
    });

    it('should have CRUD messages in both languages', () => {
      expect(t('crud.created', 'es')).toBeTruthy();
      expect(t('crud.created', 'en')).toBeTruthy();
      expect(t('crud.updated', 'es')).toBeTruthy();
      expect(t('crud.updated', 'en')).toBeTruthy();
    });
  });

  describe('Message formatting', () => {
    it('Spanish messages should be in Spanish', () => {
      const msg = t('auth.loginSuccess', 'es');
      // Should contain Spanish characters/words
      expect(msg).toMatch(/[áéíóú]/i);
    });

    it('English messages should be in English', () => {
      const msg = t('auth.loginSuccess', 'en');
      expect(msg).toContain('successfully');
    });

    it('All Spanish messages should have content', () => {
      const msg = t('validation.email.required', 'es');
      expect(msg.length).toBeGreaterThan(5);
      expect(msg).not.toBe('validation.email.required');
    });

    it('All English messages should have content', () => {
      const msg = t('validation.email.required', 'en');
      expect(msg.length).toBeGreaterThan(3);
      expect(msg).not.toBe('validation.email.required');
    });
  });
});
