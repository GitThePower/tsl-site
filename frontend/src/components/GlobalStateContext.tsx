// In a file like 'globalStateContext.js'
import React, { ReactNode, createContext, useState } from 'react';

interface GlobalStateContextObject {
  isLoggedIn: boolean;
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
}

const GlobalStateContext = createContext({} as GlobalStateContextObject);

export const GlobalStateProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false); 
  // Add other global state variables as needed

  return (
    <GlobalStateContext.Provider value={{ isLoggedIn, setIsLoggedIn }}>
      {children}
    </GlobalStateContext.Provider>
  );
};

export default GlobalStateContext;
