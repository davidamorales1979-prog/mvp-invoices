import React from 'react';
import AppNew from './AppNew';
import TermsPage from './TermsPage';
import PrivacyPage from './PrivacyPage';

export default function App() {
  const path = window.location.pathname
  if (path === '/terms') return <TermsPage />
  if (path === '/privacy') return <PrivacyPage />
  return <AppNew />
}
