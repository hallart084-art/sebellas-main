
import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { translations, LANGUAGES, SupportedLanguage, AllTranslationKeys } from '../locales';

interface LocalizationContextType {
 uiLanguage: SupportedLanguage;
 t: (key: AllTranslationKeys, params?: Record<string, string | number>) => string;
 handleLanguageChange: (langCode: SupportedLanguage) => void;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

const getInitialLanguage = (): SupportedLanguage => {
 return 'EN';
};

export const LocalizationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
 const [uiLanguage, setUiLanguage] = useState<SupportedLanguage>(getInitialLanguage);

 useEffect(() => {
 localStorage.setItem('uiLanguage', uiLanguage);
 }, [uiLanguage]);

 const t = useCallback((key: AllTranslationKeys, params?: Record<string, string | number>): string => {
 const langTranslations = translations[uiLanguage] || translations.EN;
 let translation: string = langTranslations[key] || translations.EN[key] || key;
 if (params) {
 Object.keys(params).forEach(paramKey => {
 translation = translation.split(`{${paramKey}}`).join(String(params[paramKey]));
 });
 }
 return translation;
 }, [uiLanguage]);
 
 const handleLanguageChange = useCallback((langCode: SupportedLanguage) => {
 setUiLanguage(langCode);
 }, []);
 
 return (
 <LocalizationContext.Provider value={{ uiLanguage, t, handleLanguageChange }}>
 {children}
 </LocalizationContext.Provider>
 );
};

export const useLocalizationContext = (): LocalizationContextType => {
 const context = useContext(LocalizationContext);
 if (context === undefined) {
 throw new Error('useLocalizationContext must be used within a LocalizationProvider');
  }
  return context;
};
