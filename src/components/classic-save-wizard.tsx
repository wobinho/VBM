'use client';
import Image from 'next/image';
import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Loader2, X, ChevronLeft, ChevronRight, AlertCircle, Check } from 'lucide-react';

const inputClass = "w-full px-4 py-3 bg-[var(--ink-850)] border border-white/10 rounded text-[var(--bone)] placeholder-[var(--ink-500)] focus:outline-none focus:border-[var(--volt)]/60 focus:ring-2 focus:ring-[var(--volt)]/15 transition-all font-body";
const labelClass = "block font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--ink-400)] mb-2";

const STEPS = ['Name', 'Leagues'];

interface CountryGroup {
  name: string;
  countries: Array<{ name: string; code: string; leagues: number }>;
}

const countryCodeMap: Record<string, string> = {
  'Italy': 'it', 'France': 'fr', 'Poland': 'pl', 'Turkey': 'tr',
  'Slovenia': 'si', 'Bulgaria': 'bg', 'Germany': 'de', 'Serbia': 'rs',
  'Belgium': 'be', 'Russia': 'ru', 'Ukraine': 'ua', 'Czechia': 'cz',
  'Finland': 'fi', 'Netherlands': 'nl', 'Portugal': 'pt', 'Spain': 'es',
  'Japan': 'jp', 'China': 'cn', 'South Korea': 'kr', 'Philippines': 'ph',
  'Vietnam': 'vn', 'Thailand': 'th', 'Taiwan': 'tw', 'Iran': 'ir',
  'USA': 'us', 'Brazil': 'br', 'Argentina': 'ar', 'Cuba': 'cu',
  'Dominican Republic': 'do', 'Puerto Rico': 'pr', 'Mexico': 'mx', 'Canada': 'ca',
};

const countryGroups: CountryGroup[] = [
  {
    name: 'Europe (Core)',
    countries: [
      { name: 'Italy', code: 'it', leagues: 3 },
      { name: 'France', code: 'fr', leagues: 3 },
      { name: 'Poland', code: 'pl', leagues: 3 },
      { name: 'Turkey', code: 'tr', leagues: 3 },
    ],
  },
  {
    name: 'Europe (Other)',
    countries: [
      { name: 'Slovenia', code: 'si', leagues: 1 },
      { name: 'Bulgaria', code: 'bg', leagues: 1 },
      { name: 'Germany', code: 'de', leagues: 1 },
      { name: 'Serbia', code: 'rs', leagues: 1 },
      { name: 'Belgium', code: 'be', leagues: 1 },
      { name: 'Russia', code: 'ru', leagues: 1 },
      { name: 'Ukraine', code: 'ua', leagues: 1 },
      { name: 'Czechia', code: 'cz', leagues: 1 },
      { name: 'Finland', code: 'fi', leagues: 1 },
      { name: 'Netherlands', code: 'nl', leagues: 1 },
      { name: 'Portugal', code: 'pt', leagues: 1 },
      { name: 'Spain', code: 'es', leagues: 1 },
    ],
  },
  {
    name: 'Asia',
    countries: [
      { name: 'Japan', code: 'jp', leagues: 1 },
      { name: 'China', code: 'cn', leagues: 1 },
      { name: 'South Korea', code: 'kr', leagues: 1 },
      { name: 'Philippines', code: 'ph', leagues: 1 },
      { name: 'Vietnam', code: 'vn', leagues: 1 },
      { name: 'Thailand', code: 'th', leagues: 1 },
      { name: 'Taiwan', code: 'tw', leagues: 1 },
      { name: 'Iran', code: 'ir', leagues: 1 },
    ],
  },
  {
    name: 'America',
    countries: [
      { name: 'USA', code: 'us', leagues: 1 },
      { name: 'Brazil', code: 'br', leagues: 1 },
      { name: 'Argentina', code: 'ar', leagues: 1 },
      { name: 'Cuba', code: 'cu', leagues: 1 },
      { name: 'Dominican Republic', code: 'do', leagues: 1 },
      { name: 'Puerto Rico', code: 'pr', leagues: 1 },
      { name: 'Mexico', code: 'mx', leagues: 1 },
      { name: 'Canada', code: 'ca', leagues: 1 },
    ],
  },
];

export default function ClassicSaveWizard({ onClose }: { onClose: () => void }) {
  const { createSave, selectSave } = useAuth();

  const [step, setStep] = useState(0);
  const [saveName, setSaveName] = useState('');
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const canNext = step === 0
    ? saveName.trim().length > 0
    : selectedCountries.size > 0;

  const handleToggleCountry = (country: string) => {
    const newSet = new Set(selectedCountries);
    if (newSet.has(country)) {
      newSet.delete(country);
    } else {
      newSet.add(country);
    }
    setSelectedCountries(newSet);
  };

  const handleToggleGroup = (groupCountries: string[]) => {
    const newSet = new Set(selectedCountries);
    const allSelected = groupCountries.every(c => newSet.has(c));

    if (allSelected) {
      groupCountries.forEach(c => newSet.delete(c));
    } else {
      groupCountries.forEach(c => newSet.add(c));
    }
    setSelectedCountries(newSet);
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    setError('');

    const res = await createSave(saveName, Array.from(selectedCountries));
    setCreating(false);

    if (res.success && res.saveId) {
      onClose();
      await selectSave(res.saveId);
    } else {
      setError(res.error || 'Failed to create save');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="w-full max-w-2xl surface-raised overflow-hidden animate-fade-up">
        {/* Header */}
        <div className="relative p-8 text-center border-b border-white/[0.06] overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--volt)]" />
          <div className="absolute -top-20 -right-16 w-48 h-48 rounded-full bg-[var(--volt)]/10 blur-3xl" />

          <div className="relative">
            <h2 className="font-display text-3xl tracking-[0.06em] text-[var(--bone)]">NEW CLASSIC SAVE</h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--ink-400)] mt-2">
              Select your save name and preferred leagues
            </p>

            {/* Stepper */}
            <div className="flex items-center justify-center gap-2 mt-6">
              {STEPS.map((label, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-all ${
                      i < step
                        ? 'bg-[var(--volt)] text-white'
                        : i === step
                        ? 'bg-[var(--volt)]/30 border border-[var(--volt)] text-[var(--volt)]'
                        : 'bg-white/[0.06] border border-white/10 text-[var(--ink-500)]'
                    }`}
                  >
                    {i < step ? <Check size={14} /> : i + 1}
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--ink-500)]">
                    {label}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`w-12 h-[1px] mx-2 ${
                        i < step ? 'bg-[var(--volt)]' : 'bg-white/[0.06]'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-7">
          {error && (
            <div className="flex items-center gap-2.5 p-3.5 rounded border border-[var(--loss)]/40 bg-[var(--loss)]/10 text-[var(--loss)] text-sm font-medium mb-5">
              <AlertCircle size={14} className="shrink-0" />
              <span className="flex-1">{error}</span>
              <button
                onClick={() => setError('')}
                className="opacity-60 hover:opacity-100 transition-opacity"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Step 0: Name */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Save Name</label>
                <input
                  type="text"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && canNext) setStep(1);
                  }}
                  maxLength={40}
                  autoFocus
                  className={inputClass}
                  placeholder="e.g. My First Season"
                />
                <p className="font-mono text-[9px] text-[var(--ink-500)] mt-2">
                  {saveName.length}/40 characters
                </p>
              </div>
            </div>
          )}

          {/* Step 1: League Selection */}
          {step === 1 && (
            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
              {countryGroups.map((group, groupIdx) => {
                const groupCountries = group.countries.map(c => c.name);
                const allSelected = groupCountries.every(c => selectedCountries.has(c));
                const someSelected = groupCountries.some(c => selectedCountries.has(c));

                return (
                  <div key={groupIdx} className="space-y-3">
                    {/* Group header with toggle all */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleGroup(groupCountries)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded border transition-all cursor-pointer font-mono text-[10px] uppercase tracking-wider ${
                          allSelected
                            ? 'bg-[var(--volt)]/15 border-[var(--volt)]/50 text-[var(--volt)]'
                            : someSelected
                            ? 'bg-[var(--volt)]/[0.08] border-[var(--volt)]/30 text-[var(--volt)]/70'
                            : 'bg-white/[0.02] border-white/10 text-[var(--ink-400)] hover:border-white/25'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                            allSelected
                              ? 'bg-[var(--volt)] border-[var(--volt)]'
                              : 'border-current'
                          }`}
                        >
                          {allSelected && <Check size={10} className="text-white" />}
                        </div>
                        {group.name}
                      </button>
                    </div>

                    {/* Country grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {group.countries.map(country => (
                        <button
                          key={country.name}
                          onClick={() => handleToggleCountry(country.name)}
                          className={`relative p-3 rounded border transition-all text-left ${
                            selectedCountries.has(country.name)
                              ? 'bg-[var(--volt)]/15 border-[var(--volt)]/50'
                              : 'bg-white/[0.02] border-white/10 hover:border-white/25'
                          }`}
                        >
                          {/* Checkbox */}
                          <div
                            className={`absolute top-2 right-2 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                              selectedCountries.has(country.name)
                                ? 'bg-[var(--volt)] border-[var(--volt)]'
                                : 'border-white/20'
                            }`}
                          >
                            {selectedCountries.has(country.name) && (
                              <Check size={10} className="text-white" />
                            )}
                          </div>

                          {/* Content */}
                          <div className="pr-5">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Image
                                src={`/assets/flags/${country.code}.svg`}
                                alt={country.name}
                                width={24}
                                height={16}
                                className="rounded-sm"
                              />
                              <span className="font-display text-sm tracking-wide text-[var(--bone)]">
                                {country.name}
                              </span>
                            </div>
                            <span className="font-mono text-[8px] text-[var(--ink-500)]">
                              {country.leagues} league{country.leagues > 1 ? 's' : ''}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-7 py-4 border-t border-white/[0.06]">
          <button
            onClick={() => (step > 0 ? setStep(step - 1) : onClose())}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2.5 rounded font-mono text-[10px] uppercase tracking-[0.14em] border border-white/10 text-[var(--ink-400)] hover:text-[var(--bone)] transition-colors cursor-pointer disabled:opacity-50"
          >
            <ChevronLeft size={13} />
            {step === 0 ? 'Cancel' : 'Back'}
          </button>

          {step === 1 && (
            <div className="text-[9px] text-[var(--ink-500)] font-mono tracking-wider">
              {selectedCountries.size} LEAGUE{selectedCountries.size !== 1 ? 'S' : ''} SELECTED
            </div>
          )}

          {step === 0 ? (
            <button
              onClick={() => setStep(1)}
              disabled={!canNext || creating}
              className="flex items-center gap-2 px-4 py-2.5 rounded bg-[var(--volt)] text-white font-mono text-[10px] uppercase tracking-[0.14em] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            >
              Next
              <ChevronRight size={13} />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={!canNext || creating}
              className="flex items-center gap-2 px-4 py-2.5 rounded bg-[var(--volt)] text-white font-mono text-[10px] uppercase tracking-[0.14em] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            >
              {creating ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Creating…
                </>
              ) : (
                'Create Save'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
