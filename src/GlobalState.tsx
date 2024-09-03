import React, { createContext, useContext, useReducer, ReactNode } from 'react';

interface State {
  points: number;
  totalIncome: number;
}

type Action =
  | { type: 'SET_POINTS'; payload: number }
  | { type: 'SET_TOTAL_INCOME'; payload: number };

const initialState: State = {
  points: 0,
  totalIncome: 0,
};

const GlobalStateContext = createContext<State | undefined>(undefined);
const GlobalDispatchContext = createContext<React.Dispatch<Action> | undefined>(undefined);

const globalReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_POINTS':
      return { ...state, points: action.payload };
    case 'SET_TOTAL_INCOME':
      return { ...state, totalIncome: action.payload };
    default:
      return state;
  }
};

export const GlobalStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(globalReducer, initialState);

  return (
    <GlobalStateContext.Provider value={state}>
      <GlobalDispatchContext.Provider value={dispatch}>
        {children}
      </GlobalDispatchContext.Provider>
    </GlobalStateContext.Provider>
  );
};

export const useGlobalState = () => {
  const context = useContext(GlobalStateContext);
  if (context === undefined) {
    throw new Error('useGlobalState must be used within a GlobalStateProvider');
  }
  return context;
};

export const useGlobalDispatch = () => {
  const context = useContext(GlobalDispatchContext);
  if (context === undefined) {
    throw new Error('useGlobalDispatch must be used within a GlobalStateProvider');
  }
  return context;
};