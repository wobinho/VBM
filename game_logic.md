# Volleyball Match Simulation Logic

## Current Implemented Rules

### Position-Based Restrictions
- **Libero cannot score blocks** — always in back row, ineligible for block stats
- **Libero cannot score aces** — does not serve in official rules
- **Setter rarely attacks** — 95% chance to NOT attack (primary role is setting)

### Defensive Priorities
- **Libero priority on digs** — when opposing team attacks, libero receives higher weight for dig/defense selection
- **Position-specific receive weight** — only L, OH1, OH2 are candidates for serve receive

---

## Proposed Logic Enhancements

### High Priority (Quick Wins)

#### 1. **Libero Cannot Be Setter**
- **Rule:** Libero should never occupy the `S` (setter) position in lineup
- **Rationale:** Official volleyball rules prohibit liberos from being setters in most formats
- **Implementation:** Add validation in `autoLineup()` to skip libero when picking setter
- **File:** `src/lib/match-engine.ts` → `autoLineup()` function

#### 2. **Attack Decision by Position**
- **Rule:** Different positions have different attack responsibilities
  - Outside Hitter → 80% attack chance
  - Opposite Hitter → 90% attack chance (most aggressive)
  - Middle Blocker → 70% attack chance (quick attacks + blocking duties)
  - Setter → 5% attack chance (only dumps/tips when no attackers available)
  - Libero → 0% attack chance (cannot attack from back row)
- **Rationale:** Players have position-specific roles; weak attackers shouldn't be forced into attacks
- **Implementation:** Modify `pickAttacker()` to respect position weights and filtering logic
- **File:** `src/lib/match-engine.ts` → `pickAttacker()` function

#### 3. **Setter Cannot Block**
- **Rule:** Setters have minimal block weight (nearly zero)
- **Rationale:** Setters are busy positioning to set, not blocking at net
- **Implementation:** Exclude `S` from `pickBlocker()` candidates or apply heavy penalty
- **File:** `src/lib/match-engine.ts` → `pickBlocker()` function

### Medium Priority (Better Realism)

#### 4. **Middle Blocker Blocking Advantage**
- **Rule:** Middle Blockers receive higher block weighting than outside hitters
- **Rationale:** MBs face attackers head-on at net, are taller on average, dedicated to blocking
- **Implementation:** In `pickBlocker()`, boost weight for MB1/MB2 when blocking MB attacks
- **File:** `src/lib/match-engine.ts` → `pickBlocker()` function

#### 5. **Opposite Hitter Right-Side Specialization**
- **Rule:** Opposite hitters should be weighted heavily for right-side blocks and attacks
- **Rationale:** OPP blocks opposite attackers but rarely receives serves; specialized position
- **Implementation:** Modify block/attack weighting to favor OPP on right-side situations
- **File:** `src/lib/match-engine.ts` → `pickAttacker()` and `pickBlocker()`

#### 6. **Libero Dig Priority System**
- **Rule:** When opposing team attacks, weight libero significantly higher for dig/defense
- **Current:** Libero already in receive candidates, but could be more pronounced
- **Enhancement:** When picking digger during rally, apply multiplier to libero's digging stat (e.g., +10-15 boost)
- **Rationale:** Libero is defensive specialist; spatial positioning makes them best defender in many situations
- **File:** `src/lib/match-engine.ts` → `pickReceiver()` function with rally context

#### 7. **Rotational Fatigue & Positioning Bonuses**
- **Rule:** Track player rotation position and apply bonuses/penalties
  - MB1/MB2 in front row → +5 block stat, -2 receive stat
  - Outside Hitter in back row → +3 receive stat, -2 attack stat
  - Setter wherever → setting bonus applies (already implemented)
- **Rationale:** Players perform better in their natural positions
- **Implementation:** Add `rotationPosition` tracking to rally simulation
- **File:** `src/lib/match-engine.ts` → `simulateRally()` function

#### 8. **Double Block Bonus**
- **Rule:** When MB + adjacent player both block, increase block success rate by 5-10%
- **Rationale:** Real volleyball has collective blocking; coordinated teamwork matters
- **Implementation:** Track previous blocker and apply bonus if same-side player blocks consecutively
- **File:** `src/lib/match-engine.ts` → `simulateRally()` function, block probability section

#### 9. **Service Pressure on Weak Servers**
- **Rule:** If server has serve stat < 40, increase serve error probability by 3-5%
- **Rationale:** Some players genuinely shouldn't be serving in close matches; weak servers are liability
- **Implementation:** Add conditional penalty in serve error probability calculation
- **File:** `src/lib/match-engine.ts` → `simulateRally()` serve error section

### Polish Features (Detailed Simulation)

#### 10. **Momentum from Same-Position Scoring**
- **Rule:** If same position scores 3+ consecutive points, increase that player's selection weight slightly (+2-3 boost)
- **Rationale:** Hot streaks are real; players find rhythm and opponents fear them
- **Implementation:** Track scoring by player position; apply selection boost in `pickAttacker()` / `pickBlocker()`
- **File:** `src/lib/match-engine.ts` → `simulateRally()` and picker functions

#### 11. **Block Coverage Rotation**
- **Rule:** If same blocker blocks 2 consecutive attacks, reduce block stat next rally by 5 points
- **Rationale:** Blocking is exhausting; even elite blockers get worn down
- **Implementation:** Track blocker history; apply fatigue penalty
- **File:** `src/lib/match-engine.ts` → `simulateRally()` block section

#### 12. **Setting Consistency Bonus**
- **Rule:** If setter has high consistency stat (>60), add bonus to overall attack quality (setBonus +2-3)
- **Rationale:** Consistent setters make easier kills for attackers; inconsistent setters waste attacking potential
- **Implementation:** Modify `setBonus` calculation in `simulateRally()`
- **File:** `src/lib/match-engine.ts` → `simulateRally()` attack setup section

#### 13. **Back-Row Attack Restriction**
- **Rule:** Libero/back-row player attempts attack → immediate point loss OR severe attack stat penalty (-40)
- **Rationale:** Basic volleyball rule enforcement; back-row players cannot spike
- **Implementation:** Add check in `pickAttacker()` to exclude libero, or apply huge penalty if somehow selected
- **File:** `src/lib/match-engine.ts` → `pickAttacker()` function

#### 14. **Serve Receive Formation Enforcement**
- **Rule:** Validate that only L, OH1, OH2 are serve receivers (no S, MB1, MB2)
- **Rationale:** Setters stand back to set; MBs prepare for blocking; maintains realistic formations
- **Implementation:** Current logic is correct, but could add assertions/warnings
- **File:** `src/lib/match-engine.ts` → `pickReceiver()` function

#### 15. **Opposite Hitter Serve Frequency**
- **Rule:** Opposite hitters should rarely be selected as servers (10-15% vs. 30% for others)
- **Rationale:** OPP is right-side player; generally stronger attackers selected to serve in high-pressure situations
- **Implementation:** Modify `pickServer()` to deprioritize OPP with lower weight
- **File:** `src/lib/match-engine.ts` → `pickServer()` function

---

## Implementation Strategy

### Phase 1: Positional Integrity (Critical)
1. Libero cannot be setter
2. Setter cannot block
3. Libero cannot attack
4. Libero cannot serve/ace

### Phase 2: Position-Aware Selection (High Impact)
1. Attack decision by position (position-weighted probabilities)
2. Middle Blocker blocking advantage
3. Opposite Hitter specialization

### Phase 3: Contextual Bonuses (Medium Impact)
1. Libero dig priority weighting
2. Service pressure on weak servers
3. Setting consistency bonus

### Phase 4: Simulation Depth (Polish)
1. Rotational fatigue & positioning
2. Double block bonus
3. Block coverage fatigue
4. Momentum from hot streaks

---

## Testing Checklist

- [ ] Verify libero never selected as setter
- [ ] Verify setter has near-zero block rate
- [ ] Verify different positions have different attack frequencies
- [ ] Verify libero receives more digs than other positions
- [ ] Verify weak servers (serve < 40) have higher error rates
- [ ] Verify strong setters (consistency > 60) produce better attack outcomes
- [ ] Run full match simulations and validate stat distributions
- [ ] Check that no back-row attacks occur (libero never spikes)

---

## File References

- **Main Simulation:** `src/lib/match-engine.ts`
- **Server-Side Engine:** `src/lib/simulation-engine.ts`
- **Match UI/Component:** `src/app/match/page.tsx`
