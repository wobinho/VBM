'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { LayoutDashboard, Users, ListOrdered, ShoppingCart, Swords, UserCircle, LogOut, Menu, X, Database, Briefcase, Trophy } from 'lucide-react';
import { useState } from 'react';

const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/squad', label: 'Squad Selection', icon: Users },
    { href: '/team', label: 'Team Management', icon: UserCircle },
    { href: '/office', label: 'Office', icon: Briefcase },
    { href: '/standings', label: 'Standings', icon: ListOrdered },
    { href: '/playoffs', label: 'Playoffs', icon: Trophy },
    { href: '/transfers', label: 'Transfer Market', icon: ShoppingCart },
    { href: '/match', label: 'Match Simulation', icon: Swords },
    { href: '/admin', label: 'Database Admin', icon: Database },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { user, team, logout, isAdmin } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const visibleNavItems = navItems.filter(item => item.href !== '/admin' || isAdmin);

    return (
        <>
            <button
                className="fixed top-4 left-4 z-50 lg:hidden bg-gray-800/80 backdrop-blur-sm text-white p-2 rounded-lg border border-white/10"
                onClick={() => setMobileOpen(!mobileOpen)}
            >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <aside className={`fixed lg:sticky lg:top-0 lg:self-start inset-y-0 left-0 z-40 w-64 h-screen bg-gray-900/95 backdrop-blur-xl border-r border-white/10 flex flex-col transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div className="p-6 border-b border-white/10">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                        🏐 Spike Dynasty
                    </h1>
                    {user && (
                        <div className="mt-3 space-y-2">
                            <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Manager</p>
                            <p className="text-sm font-semibold text-white">{user.displayName}</p>
                            {team && (
                                <div className="mt-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                    <p className="text-xs text-amber-400/60 uppercase tracking-widest font-medium">My Team</p>
                                    <p className="text-sm font-bold text-amber-400 mt-0.5 truncate">{team.name}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {visibleNavItems.map(item => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMobileOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                                    ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-500/10'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <Icon size={18} className={isActive ? 'text-amber-400' : ''} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {user && (
                    <div className="p-4 border-t border-white/10">
                        <button
                            onClick={logout}
                            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                        >
                            <LogOut size={18} />
                            Logout
                        </button>
                    </div>
                )}
            </aside>

            {mobileOpen && (
                <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
            )}
        </>
    );
}
