import { jwtDecode } from 'jwt-decode';

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
};

export const setToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('accessToken', token);
};

export const getRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken');
};

export const setRefreshToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('refreshToken', token);
};

export const clearAuth = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

export const decodeToken = (token: string): any => {
  try {
    return jwtDecode(token);
  } catch (error) {
    return null;
  }
};

export const isTokenExpired = (token: string): boolean => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  const currentTime = Date.now() / 1000;
  return decoded.exp < currentTime;
};

export const isAuthenticated = (): boolean => {
  const token = getToken();
  if (!token) return false;
  return !isTokenExpired(token);
};

export interface JwtUser {
  sub: string;
  email: string;
  role: 'admin' | 'analyst';
  exp: number;
}

export const getUserFromToken = (): JwtUser | null => {
  const token = getToken();
  if (!token) return null;
  const decoded = decodeToken(token);
  if (!decoded) return null;
  return {
    sub: decoded.sub ?? '',
    email: decoded.email ?? decoded.sub ?? 'Unknown',
    role: decoded.role ?? 'analyst',
    exp: decoded.exp ?? 0,
  };
};

export const getUserRole = (): 'admin' | 'analyst' | null => {
  const user = getUserFromToken();
  return user?.role ?? null;
};

export const isAdmin = (): boolean => getUserRole() === 'admin';
