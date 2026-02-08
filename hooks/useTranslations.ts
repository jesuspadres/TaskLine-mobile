import { useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import i18n from '@/i18n';

const LOCALE_STORAGE_KEY = 'taskline_locale';

/**
 * Platform-aware helpers for reading/writing persisted locale.
 * Uses SecureStore on native (iOS/Android), falls back to in-memory on web.
 */
let memoryLocale: string | null = null;

async function getPersistedLocale(): Promise<string | null> {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    try {
      const SecureStore = require('expo-secure-store');
      if (SecureStore && typeof SecureStore.getItemAsync === 'function') {
        return await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
      }
    } catch {
      // SecureStore unavailable, fall through
    }
  }
  return memoryLocale;
}

async function persistLocale(locale: string): Promise<void> {
  memoryLocale = locale;
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    try {
      const SecureStore = require('expo-secure-store');
      if (SecureStore && typeof SecureStore.setItemAsync === 'function') {
        await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, locale);
        return;
      }
    } catch {
      // SecureStore unavailable, fall through
    }
  }
}

/**
 * Convenience hook for translations.
 *
 * @returns `t` - translate a key, `locale` - current locale, `setLocale` - change and persist locale
 *
 * @example
 * ```tsx
 * const { t, locale, setLocale } = useTranslations();
 * <Text>{t('common.save')}</Text>
 * <Button title={t('settings.spanish')} onPress={() => setLocale('es')} />
 * ```
 */
export function useTranslations() {
  const [locale, setLocaleState] = useState<string>(i18n.locale);

  // On mount, load any persisted locale preference
  useEffect(() => {
    let cancelled = false;
    getPersistedLocale().then((saved) => {
      if (!cancelled && saved && saved !== i18n.locale) {
        i18n.locale = saved;
        setLocaleState(saved);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const t = useCallback(
    (key: string, options?: Record<string, unknown>): string => {
      return i18n.t(key, options);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );

  const setLocale = useCallback(async (newLocale: string) => {
    i18n.locale = newLocale;
    setLocaleState(newLocale);
    await persistLocale(newLocale);
  }, []);

  return { t, locale, setLocale };
}
