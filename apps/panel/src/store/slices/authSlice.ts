import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  isAuthenticated: false,
};

// Initialize authentication state from localStorage if available
if (initialState.token) {
  try {
    // Validate that the token exists and is not just an empty string
    const parsedToken = JSON.parse(initialState.token);
    initialState.isAuthenticated = !!parsedToken;
  } catch {
    // If token is invalid JSON, clear it
    initialState.token = null;
    initialState.isAuthenticated = false;
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
      state.isAuthenticated = true;
      // Still persist to localStorage for browser refresh persistence
      if (typeof window !== 'undefined') {
        console.log("Setting token in localStorage:", action.payload);
        
        localStorage.setItem('token', action.payload);
      }
    },
    clearToken: (state) => {
      state.token = null;
      state.isAuthenticated = false;
      // Clear from localStorage as well
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
      }
    },
  },
});

export const { setToken, clearToken } = authSlice.actions;

// Selectors
export const selectToken = (state: RootState): string | null => state.auth.token;
export const selectIsAuthenticated = (state: RootState): boolean => state.auth.isAuthenticated;
export const selectParsedToken = (state: RootState): string | null => {
  const token = state.auth.token;
  if (!token) return null;
  
  try {
    return JSON.parse(token);
  } catch {
    return null;
  }
};

export default authSlice.reducer;