import React, { useEffect } from 'react';

/**
 * DevToolsGuard - Balanced Edition
 * Keeps keyboard shortcuts and right-click blocked, 
 * but removes the 'debugger' statement to prevent conflicts with Turnstile.
 */
const DevToolsGuard: React.FC = () => {
  // Block right click and shortcuts silently
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block F12, Ctrl+Shift+I/J/C, and Ctrl+U (View Source)
      if (
        e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) || 
        (e.ctrlKey && e.key === 'u')
      ) {
        e.preventDefault();
      }
    };

    window.addEventListener('contextmenu', block);
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('contextmenu', block);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return null; // No UI
};

export default DevToolsGuard;
