import React from 'react';
import './LoadingScreen.css'; // Добавьте стили для загрузочного экрана

const LoadingScreen: React.FC = () => {
  return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p className="loading-text">Loading...</p>
    </div>
  );
};

export default LoadingScreen;
