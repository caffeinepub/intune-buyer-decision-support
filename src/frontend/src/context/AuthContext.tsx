import { type ReactNode, createContext, useContext, useState } from "react";

interface AuthContextType {
  isLoggedIn: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Always start as logged-out so login page is shown on every fresh visit
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  function login(username: string, password: string): boolean {
    if (username === "admin" && password === "intune123") {
      setIsLoggedIn(true);
      return true;
    }
    return false;
  }

  function logout() {
    setIsLoggedIn(false);
    window.location.href = "/login";
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
