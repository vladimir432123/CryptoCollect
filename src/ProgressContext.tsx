import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ProgressContextType {
  tapProfitLevel: number;
  setTapProfitLevel: (level: number) => void;
  tapIncreaseLevel: number;
  setTapIncreaseLevel: (level: number) => void;
  points: number;
  setPoints: (points: number) => void;
  remainingClicks: number;
  setRemainingClicks: (clicks: number) => void;
  maxClicks: number;
  setMaxClicks: (clicks: number) => void;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
};

export const ProgressProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tapProfitLevel, setTapProfitLevel] = useState(1);
  const [tapIncreaseLevel, setTapIncreaseLevel] = useState(1);
  const [points, setPoints] = useState(100000000);
  const [remainingClicks, setRemainingClicks] = useState(1000);
  const [maxClicks, setMaxClicks] = useState(1000);

  return (
    <ProgressContext.Provider
      value={{
        tapProfitLevel,
        setTapProfitLevel,
        tapIncreaseLevel,
        setTapIncreaseLevel,
        points,
        setPoints,
        remainingClicks,
        setRemainingClicks,
        maxClicks,
        setMaxClicks,
      }}
    >
      {children}
    </ProgressContext.Provider>
  );
};