import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/theme.css';
import { App } from './App';

// Hosted-demo fragments may lack the #root div — create it instead of crashing.
let rootEl = document.getElementById('root');
if (!rootEl) {
  rootEl = document.createElement('div');
  rootEl.id = 'root';
  document.body.appendChild(rootEl);
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
