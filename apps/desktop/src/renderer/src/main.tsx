import '@fontsource/fraunces/600.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { CompanionApp } from './companion/CompanionApp';
import './styles.css';

const companion = new URLSearchParams(window.location.search).get('view') === 'companion';
const root = document.getElementById('root');
if (root) createRoot(root).render(
  <StrictMode>
    {companion ? <CompanionApp /> : <App />}
  </StrictMode>
);
