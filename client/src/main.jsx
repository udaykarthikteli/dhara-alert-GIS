import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Splash from './Splash.jsx';
import { I18nProvider } from './i18n.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(<I18nProvider><App /><Splash /></I18nProvider>);
if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
