/**
 * Fictional player generator.
 *
 * Produces brand-new "custom" players for the fantasy draft pool (the
 * "generated" and "mixed" pool modes). Stat distribution mirrors the country
 * seed files so generated players sit naturally alongside real ones.
 */
import { calculateOverall } from './overall';

const FIRST_NAMES = [
    'Lucas', 'Mateo', 'Hugo', 'Leon', 'Adam', 'Noah', 'Liam', 'Ethan', 'Marco', 'Andrei',
    'Kenji', 'Hiro', 'Yuki', 'Diego', 'Bruno', 'Tomas', 'Pavel', 'Nikola', 'Ivan', 'Stefan',
    'Anton', 'Felix', 'Oscar', 'Viktor', 'Dmitri', 'Sergei', 'Carlos', 'Rafael', 'Pedro', 'Joao',
    'Kai', 'Aaron', 'Elias', 'Mads', 'Emil', 'Lars', 'Tobias', 'Jonas', 'Matias', 'Santiago',
    'Gabriel', 'Daniel', 'Alex', 'Filip', 'Luka', 'Janne', 'Aleksi', 'Renato', 'Cesar', 'Nico',
    'Theo', 'Milan', 'Jasper', 'Arturo', 'Enzo',
];

const LAST_NAMES = [
    'Silva', 'Rossi', 'Müller', 'Novak', 'Kovac', 'Petrov', 'Ivanov', 'Tanaka', 'Sato', 'Kim',
    'Park', 'Nguyen', 'Costa', 'Santos', 'Garcia', 'Lopez', 'Moreau', 'Dubois', 'Bauer', 'Vogel',
    'Hansen', 'Larsen', 'Nilsson', 'Virtanen', 'Korhonen', 'Wagner', 'Schmidt', 'Romano', 'Greco', 'Bianchi',
    'Marin', 'Popescu', 'Horvat', 'Jensen', 'Andersen', 'Lindberg', 'Fernandez', 'Torres', 'Mendes', 'Almeida',
    'Voss', 'Keller', 'Brandt', 'Sokolov', 'Volkov', 'Yamamoto', 'Watanabe', 'Choi', 'Tran', 'Reyes',
    'Castro', 'Lefebvre', 'Moretti', 'Sanchez', 'Weber',
];

const NATIONALITIES = [
    'Italy', 'France', 'Poland', 'Brazil', 'Argentina', 'USA', 'Japan', 'Serbia', 'Germany', 'Russia',
    'Netherlands', 'Slovenia', 'Bulgaria', 'Iran', 'Canada', 'Cuba', 'Turkey', 'Belgium', 'Finland', 'Spain',
    'Portugal', 'China', 'South Korea', 'Czechia', 'Ukraine', 'Mexico', 'Chile', 'Thailand',
];

const HEIGHT_BY_POSITION: Record<string, [number, number]> = {
    'Outside Hitter': [188, 205],
    'Middle Blocker': [198, 216],
    'Opposite Hitter': [193, 209],
    'Setter': [183, 198],
    'Libero': [175, 191],
};

function randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}
function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Math.round(v)));
}
function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

export interface GeneratedPlayer {
    player_name: string;
    position: string;
    age: number;
    country: string;
    jersey_number: number;
    overall: number;
    potential: number;
    height: number;
    attack: number; defense: number; serve: number; block: number; receive: number; setting: number;
    precision: number; flair: number; digging: number; positioning: number; ball_control: number;
    technique: number; playmaking: number; spin: number;
    speed: number; agility: number; strength: number; endurance: number; vertical: number;
    flexibility: number; torque: number; balance: number;
    leadership: number; teamwork: number; concentration: number; pressure: number; consistency: number;
    vision: number; game_iq: number; intimidation: number;
    contract_years: number; monthly_wage: number; player_value: number;
}

/** Generates one fictional player for the given position. */
export function generatePlayer(position: string): GeneratedPlayer {
    const age = clamp(randFloat(18, 35), 16, 50);
    const target = randInt(58, 86);
    const s = (lo = 0.7, hi = 1.3) => clamp(target * randFloat(lo, hi), 1, 100);

    const stats = {
        attack: s(), defense: s(), serve: s(), block: s(), receive: s(), setting: s(),
        precision: s(0.65, 1.35), flair: s(0.55, 1.40), digging: s(0.65, 1.35), positioning: s(0.70, 1.30),
        ball_control: s(0.65, 1.35), technique: s(0.65, 1.35), playmaking: s(0.60, 1.35), spin: s(0.55, 1.40),
        speed: s(0.70, 1.30), agility: s(0.70, 1.30), strength: s(0.65, 1.35), endurance: s(0.60, 1.40),
        vertical: s(0.65, 1.35), flexibility: s(0.65, 1.35), torque: s(0.60, 1.35), balance: s(0.70, 1.30),
        leadership: s(0.50, 1.35), teamwork: s(0.60, 1.30), concentration: s(0.70, 1.30), pressure: s(0.60, 1.30),
        consistency: s(0.70, 1.30), vision: s(0.60, 1.35), game_iq: s(0.60, 1.35), intimidation: s(0.50, 1.40),
    };

    const overall = calculateOverall(stats, position);

    let headroom: number;
    if (age <= 20) headroom = randFloat(8, 20);
    else if (age <= 23) headroom = randFloat(5, 14);
    else if (age <= 26) headroom = randFloat(2, 9);
    else if (age <= 30) headroom = randFloat(0, 5);
    else headroom = randFloat(0, 2);
    const potential = clamp(overall + headroom, overall, 99);

    const [hMin, hMax] = HEIGHT_BY_POSITION[position] ?? [185, 202];

    const baseValue = overall * 5000;
    const ageMod = age < 22 ? 1.3 : age < 25 ? 1.1 : age < 30 ? 1.0 : age < 35 ? 0.8 : 0.6;

    return {
        player_name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        position,
        age,
        country: pick(NATIONALITIES),
        jersey_number: randInt(1, 99),
        overall,
        potential,
        height: randInt(hMin, hMax),
        ...stats,
        contract_years: clamp(randFloat(1, 5), 1, 10),
        monthly_wage: Math.round(overall * randFloat(50, 200)),
        player_value: Math.round(baseValue * ageMod),
    };
}
