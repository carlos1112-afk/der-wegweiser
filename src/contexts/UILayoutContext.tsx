import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface UILayoutContextProps {
  isMainMenuOpen: boolean;
  setMainMenuOpen: (open: boolean) => void;
  isSearchActive: boolean;
  setSearchActive: (active: boolean) => void;
}

const UILayoutContext = createContext<UILayoutContextProps | undefined>(undefined);

export const UILayoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isMainMenuOpen, setMainMenuOpen] = useState(false);
  const [isSearchActive, setSearchActive] = useState(false);

  return (
    <UILayoutContext.Provider
      value={{
        isMainMenuOpen,
        setMainMenuOpen,
        isSearchActive,
        setSearchActive,
      }}
    >
      {children}
    </UILayoutContext.Provider>
  );
};

export const useUILayout = () => {
  const context = useContext(UILayoutContext);
  if (!context) {
    throw new Error('useUILayout must be used within a UILayoutProvider');
  }
  return context;
};
