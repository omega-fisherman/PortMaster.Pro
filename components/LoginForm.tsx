
import React, { useState } from 'react';
import { backend } from '../services/backend';
import { User, Language } from '../types';
import { t } from '../utils/translations';
import { Loader2, Ship, Globe } from 'lucide-react';

interface LoginFormProps {
  onLogin: (user: User) => void;
  lang: Language;
  setLang: (lang: Language) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLogin, lang, setLang }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await backend.login(email.trim(), password.trim());
      if (res.success && res.user) {
        onLogin(res.user);
      } else {
        // We use a generic message here or translate the backend message
        setError(t('login_error', lang));
      }
    } catch (err) {
      setError(t('status_error', lang));
    } finally {
      setLoading(false);
    }
  };

  const toggleLang = () => {
    setLang(lang === 'ar' ? 'fr' : 'ar');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ocean-800 to-ocean-600 p-4">
      
      {/* Language Toggle Absolute Top-Right/Left */}
      <button 
        onClick={toggleLang}
        className="absolute top-4 right-4 md:right-8 bg-white/20 hover:bg-white/30 text-white p-2 rounded-full flex items-center gap-2 transition-all backdrop-blur-sm z-50"
      >
        <Globe size={20} />
        <span className="uppercase font-bold text-sm">{lang}</span>
      </button>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-ocean-50 p-6 text-center border-b border-ocean-100">
          <div className="mx-auto bg-white w-16 h-16 rounded-full flex items-center justify-center shadow-md mb-4 text-ocean-600">
            <Ship size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">{t('app_title', lang)}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('login_subtitle', lang)}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100 font-bold">
              {error}
            </div>
          )}

          {/* Hidden Credentials Box */}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('email', lang)}</label>
            <input
              type="email"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 outline-none transition-all"
              placeholder="name@port.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('password', lang)}</label>
            <input
              type="password"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 outline-none transition-all"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ocean-600 hover:bg-ocean-700 text-white font-bold py-3 rounded-lg transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="animate-spin" size={20} />}
            <span>{loading ? t('loading', lang) : t('login_btn', lang)}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
