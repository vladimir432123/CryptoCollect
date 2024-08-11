import React, { createContext, useReducer, useContext, ReactNode } from 'react';

interface Upgrade {
  level: number;
  cost: number;
  profit: number;
}

interface UpgradesState {
  speedBoost: Upgrade[];
  doubleCoins: Upgrade[];
  autoClicker: Upgrade[];
  extraLife: Upgrade[];
  megaTap: Upgrade[];
  coinMagnet: Upgrade[];
  timeWarp: Upgrade[];
  luckySpin: Upgrade[];
}

const initialState: UpgradesState = {
  speedBoost: [{ level: 1, cost: 1000, profit: 600 }],
  doubleCoins: [{ level: 1, cost: 1500, profit: 700 }],
  autoClicker: [{ level: 1, cost: 2000, profit: 800 }],
  extraLife: [{ level: 1, cost: 2500, profit: 900 }],
  megaTap: [{ level: 1, cost: 3000, profit: 1000 }],
  coinMagnet: [{ level: 1, cost: 3500, profit: 1100 }],
  timeWarp: [{ level: 1, cost: 4000, profit: 1200 }],
  luckySpin: [{ level: 1, cost: 4500, profit: 1300 }],
};

type Action = { type: 'UPGRADE'; payload: { category: keyof UpgradesState; level: number } };

const reducer = (state: UpgradesState, action: Action): UpgradesState => {
  switch (action.type) {
    case 'UPGRADE':
      const { category, level } = action.payload;
      return {
        ...state,
        [category]: state[category].map((upgrade, index) =>
          index === level - 1 ? { ...upgrade, level: upgrade.level + 1 } : upgrade
        ),
      };
    default:
      return state;
  }
};

const GlobalStateContext = createContext<{ state: UpgradesState; dispatch: React.Dispatch<Action> } | undefined>(undefined);

export const GlobalStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  return <GlobalStateContext.Provider value={{ state, dispatch }}>{children}</GlobalStateContext.Provider>;
};

export const useGlobalState = () => {
  const context = useContext(GlobalStateContext);
  if (!context) {
    throw new Error('useGlobalState must be used within a GlobalStateProvider');
  }
  return context;
};