import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { ProgressProvider } from './ProgressContext';
import { GlobalStateProvider } from './GlobalState';
import { BrowserRouter } from 'react-router-dom'; // Импортируем BrowserRouter

const container = document.getElementById('root');
const root = createRoot(container!); // Create a root.

root.render(
  <React.StrictMode>
    <BrowserRouter> {/* Оборачиваем приложение в BrowserRouter */}
      <GlobalStateProvider>
        <ProgressProvider>
          <App />
        </ProgressProvider>
      </GlobalStateProvider>
    </BrowserRouter>
  </React.StrictMode>
);
