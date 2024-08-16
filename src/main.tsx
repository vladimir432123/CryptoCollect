// src/main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { ProgressProvider } from './ProgressContext';
import { GlobalStateProvider } from './GlobalState';

const container = document.getElementById('root');
const root = createRoot(container!); // Create a root.

root.render(
  <React.StrictMode>
    <GlobalStateProvider>
      <ProgressProvider>
        <App />
      </ProgressProvider>
    </GlobalStateProvider>
  </React.StrictMode>
);
