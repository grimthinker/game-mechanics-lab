import { useState, useEffect } from 'react';
import { ru } from './ru';
import { en } from './en';

export type LocaleType = 'ru' | 'en';
const dictionaries: Record<LocaleType, any> = { ru, en };

let currentLocale: LocaleType = (localStorage.getItem('game_engine_locale') as LocaleType) || 'ru';

const listeners = new Set<() => void>();

export function getLocale(): LocaleType {
  return currentLocale;
}

export function setLocale(locale: LocaleType): void {
  if (currentLocale === locale) return;
  currentLocale = locale;
  localStorage.setItem('game_engine_locale', locale);
  listeners.forEach((cb) => cb());
}

export function useLocale(): LocaleType {
  const [locale, setLocalLocale] = useState<LocaleType>(currentLocale);

  useEffect(() => {
    const handler = () => setLocalLocale(currentLocale);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return locale;
}

export function t(path: string, params?: Record<string, string | number>): string {
  const keys = path.split('.');
  let current: any = dictionaries[currentLocale] || dictionaries.ru;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return path;
    }
  }

  if (typeof current !== 'string') return path;

  if (params) {
    return Object.entries(params).reduce(
      (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
      current
    );
  }

  return current;
}
