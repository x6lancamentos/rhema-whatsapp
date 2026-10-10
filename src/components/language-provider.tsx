"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Language, TranslationKey, translations } from "@/lib/i18n/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("pt-BR");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem("app_lang") as Language;
      if (savedLang && (savedLang === "pt-BR" || savedLang === "en")) {
        setLanguageState(savedLang);
        document.documentElement.lang = savedLang === "pt-BR" ? "pt-BR" : "en";
      } else {
        // Default to pt-BR for Brazilian real estate operation
        setLanguageState("pt-BR");
        document.documentElement.lang = "pt-BR";
      }
    } catch {
      // Fallback
    }
    setMounted(true);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("app_lang", lang);
      document.documentElement.lang = lang === "pt-BR" ? "pt-BR" : "en";
    } catch {
      // ignore
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    const nextLang: Language = language === "pt-BR" ? "en" : "pt-BR";
    setLanguage(nextLang);
  }, [language, setLanguage]);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const dict = translations[language] || translations["pt-BR"];
      let text = (dict as Record<string, string>)[key] || (translations["pt-BR"] as Record<string, string>)[key] || key;

      if (params) {
        Object.entries(params).forEach(([paramKey, val]) => {
          text = text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(val));
        });
      }

      return text;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
