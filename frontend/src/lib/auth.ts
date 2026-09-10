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
