export const TRAINING_PLANS = {
  serving_specialist: {
    key: 'serving_specialist',
    name: 'Serving Specialist',
    description: 'Focus on serve technique and precision',
    stats: ['serve', 'spin', 'precision', 'ball_control'],
  },
  blocking_power: {
    key: 'blocking_power',
    name: 'Blocking Power',
    description: 'Develop blocking strength and athleticism',
    stats: ['block', 'vertical', 'strength', 'defense'],
  },
  reception_mastery: {
    key: 'reception_mastery',
    name: 'Reception Mastery',
    description: 'Master defensive passing and positioning',
    stats: ['receive', 'digging', 'balance', 'positioning'],
  },
  setter_vision: {
    key: 'setter_vision',
    name: 'Setter Vision',
    description: 'Improve setter playmaking and court awareness',
    stats: ['setting', 'playmaking', 'vision', 'game_iq'],
  },
  attack_finisher: {
    key: 'attack_finisher',
    name: 'Attack Finisher',
    description: 'Refine attacking technique and flair',
    stats: ['attack', 'technique', 'flair', 'torque'],
  },
  defensive_wall: {
    key: 'defensive_wall',
    name: 'Defensive Wall',
    description: 'Build defensive stability and coverage',
    stats: ['defense', 'positioning', 'concentration', 'digging'],
  },
  athletic_conditioning: {
    key: 'athletic_conditioning',
    name: 'Athletic Conditioning',
    description: 'Improve overall athletic performance',
    stats: ['speed', 'agility', 'endurance', 'flexibility'],
  },
  explosive_power: {
    key: 'explosive_power',
    name: 'Explosive Power',
    description: 'Develop explosive jumping and power',
    stats: ['strength', 'torque', 'vertical', 'balance'],
  },
  mental_fortitude: {
    key: 'mental_fortitude',
    name: 'Mental Fortitude',
    description: 'Strengthen mental resilience and leadership',
    stats: ['leadership', 'pressure', 'consistency', 'intimidation'],
  },
  court_intelligence: {
    key: 'court_intelligence',
    name: 'Court Intelligence',
    description: 'Enhance game reading and team coordination',
    stats: ['game_iq', 'teamwork', 'vision', 'concentration'],
  },
} as const;

export type TrainingPlanKey = keyof typeof TRAINING_PLANS;

export function getPlanByKey(key: string) {
  return (TRAINING_PLANS as Record<string, any>)[key] || null;
}

export function getAllPlanKeys(): TrainingPlanKey[] {
  return Object.keys(TRAINING_PLANS) as TrainingPlanKey[];
}
