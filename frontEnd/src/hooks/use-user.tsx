import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser } from '@/api';
import { roleDisplayName } from '@/lib/roles';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'program_manager' | 'program_leadership' | 'program_manager_out_of_school' | 'program_manager_in_school' | 'program_supervisor' | 'ybf' | 'instructor';
  status?: 'active' | 'inactive' | 'blocked' | 'pending';
  assigned_to?: string | null;
  assigned_partner_name?: string | null;
  pendingApproval?: boolean;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  refreshUser: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = () => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    console.warn('useUser called outside UserProvider; returning fallback values.');
    const fallback = {
      user: null,
      loading: false,
      refreshUser: () => {},
      hasRole: () => false,
      isAdmin: () => false,
      isProgramManager: () => false,
      isYBF: () => false,
      isInstructor: () => false,
    };
    return fallback;
  }

  const hasRole = (roles: string[]) => {
    return context.user?.role && roles.includes(context.user.role);
  };

  const isAdmin = () => hasRole(['admin']);
  const isProgramManager = () => hasRole(['admin', 'program_manager', 'program_leadership', 'program_manager_out_of_school', 'program_manager_in_school', 'program_supervisor']);
  const isYBF = () => hasRole(['ybf']);
  const isInstructor = () => hasRole(['instructor']);

  return {
    ...context,
    hasRole,
    isAdmin,
    isProgramManager,
    isYBF,
    isInstructor,
    roleDisplayName,
  };
};
