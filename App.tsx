
import React, { useState, useEffect } from 'react';
import { User, Language } from './types';
import { LoginForm } from './components/LoginForm';
import { NFCReaderView } from './components/NFCReaderView';
import { AdminView } from './components/AdminView';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [lang, setLang] = useState<Language>('ar');

  // Update HTML direction when language changes
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  // If no user is logged in, show Unified Login
  if (!currentUser) {
    return <LoginForm onLogin={setCurrentUser} lang={lang} setLang={setLang} />;
  }

  // Automatic routing based on role
  if (currentUser.role === 'NFC_OPERATOR' || currentUser.role === 'CSNS_OPERATOR') {
    return <NFCReaderView user={currentUser} onLogout={() => setCurrentUser(null)} lang={lang} setLang={setLang} />;
  }

  if (currentUser.role === 'ADMIN') {
    return <AdminView user={currentUser} onLogout={() => setCurrentUser(null)} lang={lang} setLang={setLang} />;
  }

  return <div>Role not recognized / Rôle non reconnu</div>;
};

export default App;