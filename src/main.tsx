import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Signal to GitHub Pages fallback loader that app has mounted
if (typeof window !== 'undefined') {
  (window as unknown as { __GAME_MOUNTED__?: boolean }).__GAME_MOUNTED__ = true;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
