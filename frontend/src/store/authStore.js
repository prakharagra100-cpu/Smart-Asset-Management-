import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';

export const useAuthStore = create((set) => ({
  token: localStorage.getItem('token') || null,
  user: localStorage.getItem('token') ? jwtDecode(localStorage.getItem('token')) : null,
  isAuthenticated: !!localStorage.getItem('token'),
  
  login: (token) => {
    localStorage.setItem('token', token);
    const decoded = jwtDecode(token);
    set({ token, user: decoded, isAuthenticated: true });
  },
  
  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null, isAuthenticated: false });
  }
}));
