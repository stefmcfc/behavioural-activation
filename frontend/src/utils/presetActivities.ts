import type { ActivityCategory } from '../types/activity'

export interface PresetActivity {
  readonly name: string
  readonly category: ActivityCategory
  readonly repeatable: boolean
}

// Both repeatable and one-off examples per category, so the list itself showcases
// planner_spec_006's repeatable/one-off distinction -- not just a flat list of names.
export const PRESET_ACTIVITIES: readonly PresetActivity[] = [
  { name: 'Go for a walk', category: 'ROUTINE', repeatable: true },
  { name: 'Tidy up for 10 minutes', category: 'ROUTINE', repeatable: true },
  { name: 'Drink a glass of water first thing', category: 'ROUTINE', repeatable: true },
  { name: 'Do the laundry', category: 'NECESSARY', repeatable: true },
  { name: 'Apply for jobs', category: 'NECESSARY', repeatable: false },
  { name: 'Pay a bill', category: 'NECESSARY', repeatable: false },
  { name: 'Watch a film', category: 'PLEASURABLE', repeatable: false },
  { name: 'Call a friend', category: 'PLEASURABLE', repeatable: true },
  { name: 'Work on a personal project', category: 'PLEASURABLE', repeatable: true },
  { name: 'Go somewhere for coffee', category: 'PLEASURABLE', repeatable: false },
] as const
