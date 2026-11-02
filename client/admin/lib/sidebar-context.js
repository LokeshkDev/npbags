'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const SidebarContext = createContext({
  isCollapsed: true,
  toggleSidebar: () => {},
  setIsCollapsed: () => {}
});

export function SidebarProvider({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('npgrand_admin_sidebar_collapsed');
      if (stored !== null) {
        setIsCollapsed(stored === 'true');
      } else {
        setIsCollapsed(true);
      }
    } catch (e) {}
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('npgrand_admin_sidebar_collapsed', String(next));
      } catch (e) {}
      return next;
    });
  };

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar, setIsCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}

