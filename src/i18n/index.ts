// ─────────────────────────────────────────────────
// Tirumala SevaPilot — i18n System
// ─────────────────────────────────────────────────

import en from './en/messages.json';
import te from './te/messages.json';
import hi from './hi/messages.json';
import ta from './ta/messages.json';
import kn from './kn/messages.json';

import { useState, useEffect } from 'react';

type Messages = typeof en;
export type Language = 'en' | 'te' | 'hi' | 'ta' | 'kn';

const translations: Record<Language, any> = { en, te, hi, ta, kn };

let currentLanguage: Language = 'en';
type LanguageListener = (lang: Language) => void;
const listeners = new Set<LanguageListener>();

/** Subscribe to language changes */
export function onLanguageChange(listener: LanguageListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Set the active language and notify all reactive listeners */
export function setLanguage(lang: Language): void {
  currentLanguage = lang;
  listeners.forEach(cb => {
    try { cb(lang); } catch { /* ignore subscriber error */ }
  });
}

/** Get the active language */
export function getLanguage(): Language {
  return currentLanguage;
}

/** React hook for reactive i18n without page reload */
export function useI18n() {
  const [lang, setLang] = useState<Language>(getLanguage());
  useEffect(() => {
    return onLanguageChange(newLang => setLang(newLang));
  }, []);
  return { t, language: lang, setLanguage };
}

/**
 * Translate a key path (e.g., "dashboard.scanPage").
 * Falls back to English if the key is missing in the current language.
 */
export function t(keyPath: string, params?: Record<string, string | number>): string {
  const keys = keyPath.split('.');
  let value: unknown = translations[currentLanguage];

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      // Fallback to English
      value = translations.en;
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = (value as Record<string, unknown>)[k];
        } else {
          return keyPath; // Key not found
        }
      }
      break;
    }
  }

  if (typeof value !== 'string') return keyPath;

  // Replace parameters
  if (params) {
    let result = value;
    for (const [key, val] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
    }
    return result;
  }

  return value;
}

export default { t, setLanguage, getLanguage, onLanguageChange, useI18n };
