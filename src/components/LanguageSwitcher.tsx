'use client';

import { useLanguage } from '@/contexts/LanguageContext';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={() => setLanguage('am')}
        className={`px-3 py-1 rounded-md text-sm font-medium ${
          language === 'am'
            ? 'bg-indigo-100 text-indigo-700'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        አማርኛ
      </button>
      <span className="text-gray-300">|</span>
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-1 rounded-md text-sm font-medium ${
          language === 'en'
            ? 'bg-indigo-100 text-indigo-700'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        English
      </button>
    </div>
  );
} 