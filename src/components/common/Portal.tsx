import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Dynamically load ReactDOM on web for portal rendering into document.body
let ReactDOM: any = null;
if (Platform.OS === 'web') {
  try {
    ReactDOM = require('react-dom');
  } catch (e) {
    // fallback if not available
  }
}

interface PortalProps {
  children: React.ReactNode;
  lockScroll?: boolean;
}

export const Portal: React.FC<PortalProps> = ({ children, lockScroll = true }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (Platform.OS === 'web' && lockScroll && typeof document !== 'undefined') {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [lockScroll]);

  if (Platform.OS === 'web' && typeof document !== 'undefined' && ReactDOM && ReactDOM.createPortal) {
    if (!mounted) return null;
    return ReactDOM.createPortal(children, document.body);
  }

  return <>{children}</>;
};
