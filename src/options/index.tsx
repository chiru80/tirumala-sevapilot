import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { t, useI18n, setLanguage, type Language } from '@i18n/index';
import { getSettings } from '@storage/repository';

function OptionsApp() {
  const { language } = useI18n();

  useEffect(() => {
    getSettings().then(s => {
      if (s?.language) {
        setLanguage(s.language as Language);
      }
    }).catch(() => {});
  }, []);

  return (
    <div key={language} className="max-w-2xl mx-auto p-8 text-[#321B3F] dark:text-[#F8EFD8]">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7650A3] to-[#5B2A86] flex items-center justify-center shadow-md border border-gold-500/30">
          <svg className="w-8 h-8 text-gold-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold font-serif text-[#5B2A86] dark:text-[#F8EFD8]">{t('options.title')}</h1>
          <p className="text-sm text-[#6B5A70] dark:text-[#A692B4] mt-0.5">{t('options.subtitle')}</p>
        </div>
      </div>

      <div className="sp-card mb-4 bg-white dark:bg-[#2D1A38] border-gold-500/25 p-5 space-y-2.5">
        <h2 className="text-lg font-bold font-serif text-[#5B2A86] dark:text-gold-300">{t('options.about')}</h2>
        <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">
          {t('options.aboutDesc')}
        </p>
        <p className="text-sm text-[#8B7D8F] dark:text-[#A692B4] mt-2 border-t border-gold-500/15 pt-2.5 leading-relaxed">
          {t('options.disclaimer')}
        </p>
      </div>

      <div className="sp-card bg-white dark:bg-[#2D1A38] border-gold-500/25 p-5 space-y-2.5">
        <h2 className="text-lg font-bold font-serif text-[#5B2A86] dark:text-gold-300">{t('options.fullSettings')}</h2>
        <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">
          {t('options.fullSettingsDesc')}
        </p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
);
