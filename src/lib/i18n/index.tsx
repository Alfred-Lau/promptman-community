"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { zh } from "./zh";
import { en } from "./en";
import type { Messages } from "./zh";

export type Locale = "zh" | "en";
export type Theme = "dark" | "light" | "system";

const MESSAGES: Record<Locale, Messages> = { zh, en };
const LOCALE_STORAGE_KEY = "promptman-locale";
const THEME_STORAGE_KEY = "promptman-theme";

interface LocaleContextValue {
  locale: Locale;
  t: Messages;
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  t: en,
  setLocale: () => {},
  toggleLocale: () => {},
  theme: "system",
  setTheme: () => {},
});

function applyTheme(theme: Theme) {
  const html = document.documentElement;
  if (theme === "system") {
    html.removeAttribute("data-theme");
  } else {
    html.setAttribute("data-theme", theme);
  }
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const initFromStore = async () => {
      try {
        if (typeof window !== "undefined" && window.electronAPI) {
          const result = await window.electronAPI.invoke("settings:get");
          if (result.success && result.data) {
            const { theme: savedTheme, language: savedLanguage } = result.data;
            const lang: Locale =
              savedLanguage === "zh" || savedLanguage === "en"
                ? savedLanguage
                : "en";
            setLocaleState(lang);
            try { localStorage.setItem(LOCALE_STORAGE_KEY, lang); } catch {}

            const t: Theme =
              savedTheme === "dark" || savedTheme === "light" || savedTheme === "system"
                ? savedTheme
                : "system";
            setThemeState(t);
            applyTheme(t);
            try { localStorage.setItem(THEME_STORAGE_KEY, t); } catch {}
            return;
          }
        }
      } catch {}
      // Fallback to localStorage
      try {
        const savedLang = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
        if (savedLang === "zh" || savedLang === "en") {
          setLocaleState(savedLang);
        }
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
        const t: Theme =
          savedTheme === "dark" || savedTheme === "light" || savedTheme === "system"
            ? savedTheme
            : "system";
        setThemeState(t);
        applyTheme(t);
      } catch {}
    };
    initFromStore();
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(LOCALE_STORAGE_KEY, l); } catch {}
    // Persist to store so Electron menu can also pick it up
    if (typeof window !== "undefined" && window.electronAPI) {
      window.electronAPI
        .invoke("settings:update", { language: l })
        .catch(() => {});
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => {
      const next: Locale = prev === "zh" ? "en" : "zh";
      try { localStorage.setItem(LOCALE_STORAGE_KEY, next); } catch {}
      if (typeof window !== "undefined" && window.electronAPI) {
        window.electronAPI
          .invoke("settings:update", { language: next })
          .catch(() => {});
      }
      return next;
    });
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    try { localStorage.setItem(THEME_STORAGE_KEY, t); } catch {}
  }, []);

  return (
    <LocaleContext.Provider
      value={{ locale, t: MESSAGES[locale], setLocale, toggleLocale, theme, setTheme }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
