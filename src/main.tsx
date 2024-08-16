import { GlobalStateProvider } from './GlobalState';
import { ProgressProvider } from './ProgressContext';
import ReactDOM from 'react-dom/client'; // Импортируем createRoot из react-dom/client
import React from 'react';
import App from './App';

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement!); // Используем createRoot

root.render(
  <React.StrictMode>
    <GlobalStateProvider>
      <ProgressProvider>
        <App />
      </ProgressProvider>
    </GlobalStateProvider>
  </React.StrictMode>
);
