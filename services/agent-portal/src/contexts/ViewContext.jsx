import React, { createContext, useContext, useState, useEffect } from 'react';

const ViewContext = createContext(null);

export const useView = () => {
  const context = useContext(ViewContext);
  if (!context) {
    throw new Error('useView must be used within ViewProvider');
  }
  return context;
};

export const ViewProvider = ({ children }) => {
  const [currentView, setCurrentView] = useState(() => {
    // Load from localStorage or default to 'agent'
    return localStorage.getItem('preferredView') || 'agent';
  });

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem('preferredView', currentView);
  }, [currentView]);

  const setView = (view) => {
    if (view === 'agent' || view === 'admin') {
      setCurrentView(view);
    }
  };

  const toggleView = () => {
    setCurrentView(prev => prev === 'agent' ? 'admin' : 'agent');
  };

  const value = {
    currentView,
    setView,
    toggleView
  };

  return (
    <ViewContext.Provider value={value}>
      {children}
    </ViewContext.Provider>
  );
};

export default ViewContext;
