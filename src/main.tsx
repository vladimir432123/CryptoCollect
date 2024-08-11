import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import { ProgressProvider } from './ProgressContext';

ReactDOM.render(
  <React.StrictMode>
    <ProgressProvider>
      <App />
    </ProgressProvider>
  </React.StrictMode>,
  document.getElementById('root')
);