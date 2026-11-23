import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';
import { toast } from 'react-toastify';

const AuthContext = createContext(null);

const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(!!token);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('lastActiveTime');
    setToken(null);
    setUser(null);
  };

  const triggerInactivityLogout = () => {
    logout();
    toast.warning('Logged out due to 30 minutes of inactivity.', {
      toastId: 'inactivity-logout-toast'
    });
  };

  // Auto logout on inactivity (for representatives and admins)
  useEffect(() => {
    if (!token || !user) return;
    if (user.role !== 'representative' && user.role !== 'admin' && user.role !== 'superadmin') return;

    let logoutTimer;

    const updateActivity = () => {
      const now = Date.now();
      const lastActive = parseInt(localStorage.getItem('lastActiveTime') || '0', 10);
      
      // If time already exceeded 30 minutes, trigger logout immediately
      if (lastActive && now - lastActive > INACTIVITY_LIMIT) {
        triggerInactivityLogout();
        return;
      }

      // Throttle localStorage updates to once every 5 seconds
      if (!lastActive || now - lastActive > 5000) {
        localStorage.setItem('lastActiveTime', now.toString());
      }

      if (logoutTimer) clearTimeout(logoutTimer);
      logoutTimer = setTimeout(() => {
        triggerInactivityLogout();
      }, INACTIVITY_LIMIT);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const lastActive = parseInt(localStorage.getItem('lastActiveTime') || '0', 10);
        if (lastActive && now - lastActive > INACTIVITY_LIMIT) {
          triggerInactivityLogout();
        } else {
          updateActivity();
        }
      }
    };

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(evt => {
      document.addEventListener(evt, updateActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    updateActivity(); // Initialize timer and timestamp

    return () => {
      if (logoutTimer) clearTimeout(logoutTimer);
      activityEvents.forEach(evt => {
        document.removeEventListener(evt, updateActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token, user]); // eslint-disable-line

  useEffect(() => {
    const verifyToken = async () => {
      if (token) {
        const lastActive = parseInt(localStorage.getItem('lastActiveTime') || '0', 10);
        // If app reopens after 30+ minutes of inactivity, log out immediately
        if (lastActive && Date.now() - lastActive > INACTIVITY_LIMIT) {
          logout();
          toast.warning('Logged out due to 30 minutes of inactivity.', {
            toastId: 'inactivity-logout-toast'
          });
          setLoading(false);
          return;
        }

        try {
          const res = await authAPI.getMe();
          setUser(res.data.user);
          localStorage.setItem('lastActiveTime', Date.now().toString());
        } catch (error) {
          logout();
        }
      }
      setLoading(false);
    };
    verifyToken();
    // eslint-disable-next-line
  }, []);

  const login = async (email, password, selectedUserId = null) => {
    const res = await authAPI.login({ email, password, selectedUserId });
    if (res.data && res.data.requiresSelection) {
      return res.data;
    }
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('lastActiveTime', Date.now().toString());
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const register = async (formData, autoLogin = true) => {
    const res = await authAPI.register(formData);
    const { token: newToken, user: userData } = res.data;
    
    if (autoLogin) {
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('lastActiveTime', Date.now().toString());
      setToken(newToken);
      setUser(userData);
      return userData;
    }
    
    return userData; // Just return for verification
  };

  const switchAccount = async (targetUserId) => {
    const res = await authAPI.switchAccount(targetUserId);
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('lastActiveTime', Date.now().toString());
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, switchAccount }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
