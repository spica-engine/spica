import {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useState,
    useContext,
    type ReactNode,
} from 'react';
import useLocalStorage from '../custom-hooks/useLocalStorage';
import type { IUser } from '../types/user';

async function mockLoginRequest(email: string, password: string): Promise<{ ok: boolean; token: string }> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({ ok: true, token: '1234567890' });
        }, 1000);
    });
}

interface IAuthContext {
    user: IUser | null;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<IAuthContext | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [userToken, setUserToken] = useLocalStorage<string | null>('userToken', null);
    const [user, setUser] = useState<IUser | null>(null);
    const [loading, setLoading] = useState(true);

    const isAuthenticated = !!user;

    const fetchUser = useCallback(async () => {
        if (!userToken) {
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/me', {
                headers: {
                    Authorization: `Bearer ${userToken}`,
                },
            });

            if (!response.ok) throw new Error('Failed to fetch user');

            const data = await response.json();
            setUser(data.user ?? null);
        } catch (error) {
            console.error('Fetch user error:', error);
            setUserToken(null);
        } finally {
            setLoading(false);
        }
    }, [userToken, setUserToken]);

    useEffect(() => {
        if (user) return;
        fetchUser();
    }, [user, fetchUser]);

    const login = useCallback(async (email: string, password: string) => {
        setLoading(true);
        try {
            const response = await mockLoginRequest(email, password);
            if (response.ok) {
                setUserToken(response.token);
            }
        } catch (error) {
            console.error('Login error:', error);
        } finally {
            setLoading(false);
        }
    }, [setUserToken]);

    const logout = useCallback(() => {
        setUserToken(null);
        setUser(null);
    }, [setUserToken]);

    const contextValue = useMemo(
        () => ({ user, isAuthenticated, login, logout, loading }),
        [user, isAuthenticated, login, logout, loading]
    );

    return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
}

export default AuthContext;
