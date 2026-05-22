'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { CustomWorldConfig } from '@/lib/custom-save';

interface User { id: string; email: string; username: string; displayName: string; isAdmin?: boolean; }
interface Team { id: number; name: string; league_id: number; }
interface League { id: number; league_name: string; }

export interface SaveSummary {
    id: string;
    name: string;
    save_type: 'classic' | 'custom';
    status: 'creating' | 'ready';
    created_at: string;
    last_played: string | null;
}

interface AuthContextType {
    user: User | null;
    team: Team | null;
    isAdmin: boolean;
    availableLeagues: League[];
    activeSave: SaveSummary | null;
    needsSaveSelection: boolean;
    draftPending: boolean;
    saves: SaveSummary[];
    loading: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    register: (data: { email: string; password: string; username: string; displayName: string }) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    createTeam: (teamName: string, leagueId: number) => Promise<{ success: boolean; error?: string }>;
    joinTeam: (teamId: number) => Promise<{ success: boolean; error?: string }>;
    refresh: () => Promise<void>;
    loadSaves: () => Promise<void>;
    selectSave: (saveId: string) => Promise<{ success: boolean; error?: string }>;
    createSave: (name: string) => Promise<{ success: boolean; error?: string }>;
    createCustomSave: (config: CustomWorldConfig) => Promise<{ success: boolean; error?: string; saveId?: string }>;
    deleteSave: (saveId: string) => Promise<{ success: boolean; error?: string }>;
    switchSave: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [team, setTeam] = useState<Team | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [availableLeagues, setAvailableLeagues] = useState<League[]>([]);
    const [activeSave, setActiveSave] = useState<SaveSummary | null>(null);
    const [draftPending, setDraftPending] = useState(false);
    const [saves, setSaves] = useState<SaveSummary[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            setUser(data.user ?? null);
            setTeam(data.team ?? null);
            setActiveSave(data.activeSave ?? null);
            setDraftPending(data.draftPending ?? false);
            setIsAdmin(data.user?.isAdmin ?? false);
            setAvailableLeagues(data.availableLeagues ?? []);
        } catch {
            setUser(null); setTeam(null); setActiveSave(null); setIsAdmin(false); setDraftPending(false);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const loadSaves = useCallback(async () => {
        try {
            const res = await fetch('/api/saves');
            if (!res.ok) return;
            const data = await res.json();
            setSaves(data.saves ?? []);
        } catch { /* ignore — picker shows an empty list */ }
    }, []);

    const login = async (email: string, password: string) => {
        const res = await fetch('/api/auth/login', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ email, password }) });
        const data = await res.json();
        if (data.success) {
            setUser(data.user);
            setIsAdmin(data.user?.isAdmin ?? false);
            setTeam(null);
            setActiveSave(null);
            return { success: true };
        }
        return { success: false, error: data.error };
    };

    const register = async (regData: { email: string; password: string; username: string; displayName: string }) => {
        const res = await fetch('/api/auth/register', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(regData) });
        const data = await res.json();
        if (data.success) {
            setUser(data.user);
            setTeam(null);
            setActiveSave(null);
            return { success: true };
        }
        return { success: false, error: data.error };
    };

    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        setUser(null); setTeam(null); setIsAdmin(false); setAvailableLeagues([]);
        setActiveSave(null); setSaves([]); setDraftPending(false);
    };

    const selectSave = async (saveId: string) => {
        const res = await fetch('/api/saves/select', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ saveId }) });
        const data = await res.json();
        if (!data.success) return { success: false, error: data.error };
        await refresh();
        return { success: true };
    };

    const switchSave = async () => {
        await fetch('/api/saves/select', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ saveId: null }) });
        setActiveSave(null);
        setTeam(null);
        setAvailableLeagues([]);
        setDraftPending(false);
    };

    const createSave = async (name: string) => {
        const res = await fetch('/api/saves', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ name, type: 'classic' }) });
        const data = await res.json();
        if (!data.success) return { success: false, error: data.error };
        await loadSaves();
        return { success: true };
    };

    const createCustomSave = async (config: CustomWorldConfig) => {
        const res = await fetch('/api/saves/custom', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(config) });
        const data = await res.json();
        if (!data.success) return { success: false, error: data.error };
        await loadSaves();
        return { success: true, saveId: data.save?.id as string };
    };

    const deleteSave = async (saveId: string) => {
        const res = await fetch(`/api/saves/${saveId}`, { method: 'DELETE' });
        const data = await res.json();
        if (!data.success) return { success: false, error: data.error };
        await loadSaves();
        return { success: true };
    };

    const createTeam = async (teamName: string, leagueId: number) => {
        const res = await fetch('/api/teams', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ teamName, leagueId }) });
        const data = await res.json();
        if (data.success) { setTeam(data.team); return { success: true }; }
        return { success: false, error: data.error };
    };

    const joinTeam = async (teamId: number) => {
        const res = await fetch('/api/teams/join', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ teamId }) });
        const data = await res.json();
        if (data.success) {
            setTeam(data.team);
            await refresh();
            return { success: true };
        }
        return { success: false, error: data.error };
    };

    const needsSaveSelection = !!user && !activeSave;

    return (
        <AuthContext.Provider value={{
            user, team, isAdmin, availableLeagues, activeSave, needsSaveSelection, draftPending, saves, loading,
            login, register, logout, createTeam, joinTeam, refresh,
            loadSaves, selectSave, createSave, createCustomSave, deleteSave, switchSave,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
