'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface User { id: string; email: string; username: string; displayName: string; isAdmin?: boolean; }
interface Team { id: number; name: string; }
interface League { id: number; league_name: string; }
interface AuthContextType {
    user: User | null;
    team: Team | null;
    isAdmin: boolean;
    availableLeagues: League[];
    loading: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    register: (data: { email: string; password: string; username: string; displayName: string }) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    createTeam: (teamName: string, leagueId: number) => Promise<{ success: boolean; error?: string }>;
    joinTeam: (teamId: number) => Promise<{ success: boolean; error?: string }>;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [team, setTeam] = useState<Team | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [availableLeagues, setAvailableLeagues] = useState<League[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            setUser(data.user);
            setTeam(data.team);
            setIsAdmin(data.user?.isAdmin ?? false);
            if (data.availableLeagues) setAvailableLeagues(data.availableLeagues);
        } catch { setUser(null); setTeam(null); setIsAdmin(false); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const login = async (email: string, password: string) => {
        const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        const data = await res.json();
        if (data.success) {
            setUser(data.user);
            setTeam(data.team);
            setIsAdmin(data.user?.isAdmin ?? false);
            if (!data.team) await refresh();
            return { success: true };
        }
        return { success: false, error: data.error };
    };

    const register = async (regData: { email: string; password: string; username: string; displayName: string }) => {
        const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(regData) });
        const data = await res.json();
        if (data.success) { setUser(data.user); return { success: true }; }
        return { success: false, error: data.error };
    };

    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        setUser(null); setTeam(null); setIsAdmin(false); setAvailableLeagues([]);
    };

    const createTeam = async (teamName: string, leagueId: number) => {
        const res = await fetch('/api/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamName, leagueId }) });
        const data = await res.json();
        if (data.success) { setTeam(data.team); return { success: true }; }
        return { success: false, error: data.error };
    };

    const joinTeam = async (teamId: number) => {
        const res = await fetch('/api/teams/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId }) });
        const data = await res.json();
        if (data.success) { setTeam(data.team); return { success: true }; }
        return { success: false, error: data.error };
    };

    return (
        <AuthContext.Provider value={{ user, team, isAdmin, availableLeagues, loading, login, register, logout, createTeam, joinTeam, refresh }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
