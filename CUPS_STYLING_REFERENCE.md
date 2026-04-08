# Cups Page - Styling Reference Guide

Quick reference for the modern styling applied to each component.

---

## 🎨 Color Codes Reference

### Primary Colors
```
Amber (Trophy):        #FBBF24 (bg-amber-400, text-amber-300)
Orange (Accent):       #F97316 (via-orange-500)
Purple (Accent):       #7C3AED (border-purple-500)
Red (Energy):          #DC2626 (energy/intensity)
Slate (Background):    #0F172A (bg-slate-900)
White/Transparent:     rgba(255,255,255,0.1) (borders/glass)
Emerald (Complete):    #10B981 (status-completed)
```

---

## 🏗️ Component Styling Guide

### Hero Section
```jsx
<div className="relative overflow-hidden rounded-3xl border border-white/10 
                 bg-gradient-to-br from-slate-900/50 via-purple-900/20 to-slate-900/40 
                 backdrop-blur-lg p-8">
  <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-amber-500/5 
                  pointer-events-none" />
  {/* Content with relative positioning */}
</div>
```

**Key Classes:**
- `rounded-3xl` — Large rounded corners
- `backdrop-blur-lg` — Glassmorphism effect
- `from-slate-900/50 via-purple-900/20` — Multi-step gradient
- `border-white/10` — Subtle glass border

### Trophy Icon Container
```jsx
<div className="w-16 h-16 rounded-2xl 
                bg-gradient-to-br from-amber-500/30 to-orange-600/20 
                border border-amber-500/40 
                flex items-center justify-center flex-shrink-0 
                shadow-lg shadow-amber-500/20">
  <Trophy className="text-amber-300" size={32} />
</div>
```

**Key Classes:**
- `shadow-lg shadow-amber-500/20` — Colored shadow glow
- `from-amber-500/30 to-orange-600/20` — Gradient background

### Status Badge
```jsx
<div className="inline-block px-4 py-2 rounded-full 
                bg-emerald-500/20 border border-emerald-500/30">
  <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">
    ✓ Completed
  </p>
</div>
```

**Active Status Variant:**
```jsx
<div className="inline-block px-4 py-2 rounded-full 
                bg-amber-500/20 border border-amber-500/30">
  <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
    ◉ Active
  </p>
</div>
```

### View Toggle Buttons
```jsx
{/* Active State */}
<button className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold 
                   text-sm transition-all duration-200 cursor-pointer
                   bg-amber-500/20 text-amber-300 
                   border border-amber-500/40 
                   shadow-lg shadow-amber-500/10">
  <LayoutList size={18} />
  <span>List</span>
</button>

{/* Inactive State */}
<button className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold 
                   text-sm transition-all duration-200 cursor-pointer
                   bg-white/5 text-gray-400 
                   border border-white/5 
                   hover:bg-white/10 hover:text-gray-300">
  <Share2 size={18} className="rotate-90" />
  <span>Bracket</span>
</button>
```

### Fixture Card (List View)
```jsx
<div className="group relative 
                bg-gradient-to-br from-slate-900/50 to-slate-800/30 
                border border-white/10 rounded-2xl p-5 
                hover:border-white/20 hover:from-slate-900/60 hover:to-slate-800/40 
                transition-all duration-200 cursor-pointer backdrop-blur-sm">
  {/* Team matchup content */}
</div>
```

**Highlighted for User's Team:**
```jsx
<div className="group relative 
                bg-gradient-to-br from-amber-500/20 to-orange-500/10 
                border border-amber-500/40 
                hover:border-amber-500/60 
                shadow-lg shadow-amber-500/15
                rounded-2xl p-5 transition-all duration-200 cursor-pointer">
  {/* Content */}
</div>
```

### Team Logo Container
```jsx
<TeamLogo teamId={fixture.home_team_id} size={40} />

{/* Fallback when logo fails to load */}
<div className="rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 
                border border-purple-500/20 shrink-0" 
     style={{ width: 40, height: 40 }} />
```

### Score Display
```jsx
<span className="text-2xl font-black tabular-nums shrink-0 
                 ${homeWon ? 'text-amber-400' : 'text-gray-500'}">
  {fixture.home_sets}
</span>
```

### Status Indicator Badge
```jsx
{/* Completed */}
<span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
  ✓ Final
</span>

{/* Scheduled */}
<span className="text-xs font-bold uppercase tracking-widest text-amber-400/70">
  Scheduled
</span>
```

### Winner Badge
```jsx
<div className="flex items-center gap-1">
  <Trophy size={12} className="text-amber-400" />
  <span className="text-xs font-bold text-amber-400 uppercase">Winner</span>
</div>
```

### Champion Section (Best-of-3 Final)
```jsx
<div className="relative rounded-2xl border overflow-hidden 
                transition-all duration-300 backdrop-blur-sm
                bg-gradient-to-br from-amber-500/15 to-orange-500/5 
                border-amber-500/40 
                shadow-xl shadow-amber-500/20">
  <div className="px-5 py-3 border-b 
                  bg-amber-500/10 border-amber-500/20">
    <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
      Best-of-3 Series
    </span>
  </div>
  {/* Team matchups */}
</div>
```

### Win Counter Box
```jsx
<div className="flex gap-2 shrink-0">
  {[0, 1, 2].map(i => (
    <div key={i}
         className={`w-7 h-7 rounded-lg flex items-center justify-center 
                     text-xs font-bold transition-all
                     ${i < side.wins
                       ? 'bg-gradient-to-br from-amber-500 to-orange-500 
                          text-white shadow-lg shadow-amber-500/30'
                       : 'bg-white/10 border border-white/20 text-gray-500'
                     }`}>
      {i < side.wins ? '✓' : i + 1}
    </div>
  ))}
</div>
```

### Round Header
```jsx
<div className="flex items-center gap-3 mb-6">
  {/* Icon Container */}
  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 
                  transition-all
                  bg-gradient-to-br from-amber-500/30 to-orange-500/20 
                  border border-amber-500/40 
                  shadow-lg shadow-amber-500/20">
    <Star size={18} className="text-amber-300" />
  </div>
  
  {/* Title */}
  <h2 className="text-sm font-bold uppercase tracking-wider 
                 text-amber-300">
    Grand Final
  </h2>
  
  {/* Divider */}
  <div className="flex-1 min-w-[20px] h-px bg-amber-500/20" />
</div>
```

### Champion Display Banner
```jsx
<div className="relative rounded-3xl overflow-hidden 
                border border-amber-500/40 
                bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/5 
                backdrop-blur-sm">
  <div className="absolute inset-0 bg-gradient-to-r from-amber-500/15 
                  via-orange-500/10 to-amber-500/5" />
  
  <div className="relative flex items-center gap-6 px-8 py-8">
    {/* Trophy Icon with Glow */}
    <div className="relative shrink-0">
      <div className="absolute inset-0 rounded-2xl 
                      bg-gradient-to-br from-amber-500/40 to-orange-500/20 
                      blur-xl opacity-60" />
      <div className="relative w-16 h-16 rounded-2xl 
                      bg-gradient-to-br from-amber-500/30 to-orange-500/15 
                      border border-amber-500/50 
                      flex items-center justify-center 
                      shadow-xl shadow-amber-500/20">
        <Crown size={32} className="text-amber-300" />
      </div>
    </div>
    
    {/* Champion Info */}
    <div className="flex-1 min-w-0">
      <p className="text-xs text-amber-400/80 uppercase 
                    tracking-wider font-bold mb-2">
        🏆 Copa Italia Champion 🏆
      </p>
      <p className="text-3xl font-black text-amber-200 truncate">
        {championName}
      </p>
    </div>
    
    {/* Team Logo */}
    <div className="shrink-0 opacity-90">
      <TeamLogo teamId={championId} size={64} />
    </div>
  </div>
</div>
```

---

## 🎯 Transition & Animation Classes

### Smooth Transitions
```css
transition-all duration-200
transition: color 200ms, border-color 200ms, background-color 200ms;
```

### Hover Effects
```css
/* Cards */
hover:border-white/20
hover:from-slate-900/60 hover:to-slate-800/40

/* Buttons */
hover:bg-white/10
hover:text-gray-300
hover:border-amber-500/60

/* Colors */
hover:text-amber-300
```

### Active States
```css
/* Pulsing indicator for active round */
bg-amber-500 animate-pulse

/* Highlighted state */
border border-amber-500/40
shadow-lg shadow-amber-500/10
```

---

## 📐 Spacing Reference

```
Micro:   4px   (border-related)
Small:   8px   (icon-to-text gaps)
Base:    16px  (card padding p-4, p-5)
Large:   24px  (section gaps)
XL:      48px  (major sections)
```

### Padding Examples
```
p-3   = 12px  (compact)
p-4   = 16px  (standard)
p-5   = 20px  (generous)
p-8   = 32px  (hero section)
```

### Gap Examples
```
gap-1  = 4px
gap-2  = 8px
gap-3  = 12px
gap-4  = 16px
gap-6  = 24px
```

---

## 🔤 Typography Reference

### Font Sizes
```
text-xs      = 12px  (status badges, timestamps)
text-sm      = 14px  (body text, fixture names)
text-base    = 16px  (default)
text-lg      = 18px  (larger labels)
text-2xl     = 24px  (section titles)
text-3xl     = 30px  (champion name)
text-4xl     = 36px  (page title)
text-5xl     = 48px  (hero heading)
```

### Font Weights
```
font-medium   = 500  (accent text)
font-bold     = 700  (headings, important)
font-black    = 900  (heavy emphasis, scores)
```

### Text Cases
```
uppercase              = All caps
tracking-wider        = Increased letter spacing
tracking-widest       = Maximum letter spacing
truncate              = Single line, ellipsis
```

---

## 📱 Responsive Breakpoints

```
Mobile:    < 640px   (full width, stacked)
Tablet:    640-1024px (2 columns)
Desktop:   > 1024px  (3-4 columns)
```

### Grid Examples
```jsx
{/* List view fixtures grid */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">

{/* Standard responsive container */}
<div className="flex flex-col gap-4 md:flex-row md:gap-6">

{/* Viewport toggle text */}
<p className="text-xl md:text-4xl">Responsive Text</p>
```

---

## ✅ Quick Copy-Paste Templates

### Modern Glass Card
```jsx
<div className="bg-gradient-to-br from-slate-900/50 to-slate-800/30 
                border border-white/10 rounded-2xl p-5 
                hover:border-white/20 transition-all duration-200 
                cursor-pointer backdrop-blur-sm">
  {/* Content */}
</div>
```

### Amber Status Badge
```jsx
<div className="px-4 py-2 rounded-full 
                bg-amber-500/20 border border-amber-500/30">
  <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
    Active
  </span>
</div>
```

### Icon Box with Glow
```jsx
<div className="w-10 h-10 rounded-xl 
                bg-gradient-to-br from-amber-500/30 to-orange-500/20 
                border border-amber-500/40 
                flex items-center justify-center 
                shadow-lg shadow-amber-500/20">
  <Trophy size={18} className="text-amber-300" />
</div>
```

---

This guide covers all the styling patterns used in the modern cups page redesign. Reference these snippets when making future updates or modifications!
