import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/noto-sans-arabic/arabic-400.css';
import '@fontsource/noto-sans-arabic/arabic-600.css';

import './index.css';
import App from './App';
import { ToastProvider } from './components/Toast';
import { AuthProvider } from './lib/auth';
import { firebaseConfigured } from './lib/firebase';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      {firebaseConfigured ? (
        <AuthProvider>
          <App />
        </AuthProvider>
      ) : (
        <App />
      )}
    </ToastProvider>
  </StrictMode>,
);
