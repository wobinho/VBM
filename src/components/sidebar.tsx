'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { LayoutDashboard, Users, ListOrdered, ShoppingCart, Swords, UserCircle, LogOut, Menu, X, Database, Briefcase, Trophy, UserCog, Shield, BarChart2, Dumbbell, Save, Repeat } from 'lucide-react';
import { useState } from 'react';

const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false, group: 'PLAY' },
    { href: '/squad', label: 'Squad', icon: Users, adminOnly: false, group: 'PLAY' },
    { href: '/team', label: 'Team', icon: UserCircle, adminOnly: false, group: 'PLAY' },
    { href: '/training', label: 'Training', icon: Dumbbell, adminOnly: false, group: 'PLAY' },
    { href: '/office', label: 'Office', icon: Briefcase, adminOnly: false, group: 'PLAY' },
    { href: '/standings', label: 'Standings', icon: ListOrdered, adminOnly: false, group: 'COMPETE' },
    { href: '/playoffs', label: 'Playoffs', icon: Trophy, adminOnly: false, group: 'COMPETE' },
    { href: '/cups', label: 'Cups', icon: Shield, adminOnly: false, group: 'COMPETE' },
    { href: '/transfers', label: 'Transfer Market', icon: ShoppingCart, adminOnly: false, group: 'COMPETE' },
    { href: '/transfers/stats', label: 'Stats', icon: BarChart2, adminOnly: false, group: 'COMPETE' },
    { href: '/match', label: 'Match Sim', icon: Swords, adminOnly: true, group: 'ADMIN' },
    { href: '/admin', label: 'Database', icon: Database, adminOnly: true, group: 'ADMIN' },
    { href: '/player-admin', label: 'Player Admin', icon: UserCog, adminOnly: true, group: 'ADMIN' },
    { href: '/team-admin', label: 'Team Admin', icon: Shield, adminOnly: true, group: 'ADMIN' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { user, team, logout, isAdmin, activeSave, switchSave } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const visibleNavItems = navItems.filter(item => !item.adminOnly || isAdmin);

    const grouped = visibleNavItems.reduce<Record<string, typeof navItems>>((acc, item) => {
        (acc[item.group] ||= []).push(item);
        return acc;
    }, {});

    return (
        <>
            <button
                className="fixed top-4 left-4 z-50 lg:hidden bg-[var(--ink-900)]/90 backdrop-blur-sm text-[var(--bone)] p-2.5 rounded border border-white/10"
                onClick={() => setMobileOpen(!mobileOpen)}
            >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <aside className={`fixed lg:sticky lg:top-0 lg:self-start inset-y-0 left-0 z-40 w-72 h-screen flex flex-col transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
                style={{
                    background: 'linear-gradient(180deg, #0c0c10 0%, #08080b 100%)',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                }}>
                {/* Top brand band */}
                <div className="relative px-6 pt-7 pb-5 border-b border-white/[0.05]">
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--volt)]" />
                    <div className="flex items-center gap-3">
                        <Image
                            src="/assets/vbm_logo.png"
                            alt="VBM"
                            width={48}
                            height={48}
                            priority
                            className="w-12 h-12 object-contain"
                        />
                        <h1 className="font-display text-3xl tracking-[0.08em] text-[var(--bone)] leading-none">VBM</h1>
                    </div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--ink-500)] mt-3">v0.4 // est. 2026</p>
                </div>

                {/* Manager card */}
                {user && (
                    <div className="px-6 py-4 border-b border-white/[0.05]">
                        <p className="eyebrow mb-2">Manager</p>
                        <p className="font-display text-lg tracking-wide text-[var(--bone)] leading-tight">{user.displayName.toUpperCase()}</p>
                        {activeSave && (
                            <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--ink-500)] mt-1.5 flex items-center gap-1.5">
                                <Save size={9} className="text-[var(--ink-600)] shrink-0" />
                                <span className="truncate">{activeSave.name}</span>
                            </p>
                        )}
                        {team && (
                            <div className="mt-3 p-3 relative overflow-hidden"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(250,204,21,0.08) 0%, rgba(250,204,21,0.02) 100%)',
                                    border: '1px solid rgba(250,204,21,0.18)',
                                    borderRadius: '6px',
                                }}>
                                <div className="absolute top-0 right-0 w-12 h-12 bg-[var(--volt)]/10 rounded-full blur-xl" />
                                <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-[var(--volt)]/80">My Franchise</p>
                                <p className="font-display text-xl tracking-wide text-[var(--volt)] mt-1 leading-tight truncate">{team.name.toUpperCase()}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Navigation */}
                <nav className="flex-1 px-4 py-5 overflow-y-auto space-y-6">
                    {Object.entries(grouped).map(([group, items]) => (
                        <div key={group}>
                            <div className="flex items-center gap-2 px-3 mb-2">
                                <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-[var(--ink-500)]">{group}</span>
                                <div className="flex-1 h-px bg-white/[0.05]" />
                            </div>
                            <div className="space-y-0.5">
                                {items.map(item => {
                                    const isActive = pathname === item.href;
                                    const Icon = item.icon;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => setMobileOpen(false)}
                                            className={`group relative flex items-center gap-3 px-3 py-2.5 text-sm font-semibold transition-all duration-150 ${isActive
                                                ? 'text-[var(--volt)]'
                                                : 'text-[var(--ink-400)] hover:text-[var(--bone)]'
                                                }`}
                                        >
                                            {isActive && (
                                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[var(--volt)] rounded-r" />
                                            )}
                                            <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                                            <span className={`tracking-wide ${isActive ? 'font-bold' : ''}`}>{item.label}</span>
                                            {isActive && (
                                                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--volt)] animate-pulse" />
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Footer */}
                {user && (
                    <div className="px-4 py-4 border-t border-white/[0.05] space-y-2">
                        <button
                            onClick={() => switchSave()}
                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-xs font-mono uppercase tracking-[0.22em] text-[var(--ink-400)] hover:text-[var(--volt)] border border-white/[0.06] hover:border-[var(--volt)]/40 rounded transition-all duration-150 cursor-pointer"
                        >
                            <Repeat size={13} />
                            Switch Save
                        </button>
                        <button
                            onClick={logout}
                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-xs font-mono uppercase tracking-[0.22em] text-[var(--ink-400)] hover:text-[var(--loss)] border border-white/[0.06] hover:border-[var(--loss)]/40 rounded transition-all duration-150 cursor-pointer"
                        >
                            <LogOut size={13} />
                            Sign Out
                        </button>
                    </div>
                )}
            </aside>

            {mobileOpen && (
                <div className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
            )}
        </>
    );
}
