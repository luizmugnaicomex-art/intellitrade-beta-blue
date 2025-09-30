
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App, TranslationProvider } from './App';
import { HashRouter } from 'react-router-dom';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <HashRouter>
        <TranslationProvider>
          <App />
        </TranslationProvider>
      </HashRouter>
    </React.StrictMode>
  );
} else {
    throw new Error("Could not find root element to mount to");
}