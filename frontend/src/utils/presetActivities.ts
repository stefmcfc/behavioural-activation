import type { ActivityCategory } from '../types/activity'

export interface PresetActivity {
  readonly name: string
  readonly category: ActivityCategory
  readonly repeatable: boolean
}

// Both repeatable and one-off examples per category, so the list itself showcases
// planner_spec_006's repeatable/one-off distinction -- not just a flat list of names.
export const PRESET_ACTIVITIES: readonly PresetActivity[] = [
  { name: 'Wash the dishes', category: 'ROUTINE', repeatable: true },
  { name: 'Eat a healthy meal', category: 'ROUTINE', repeatable: true },
  { name: 'Wash the car', category: 'ROUTINE', repeatable: true },
  { name: 'Stick to a regular bedtime', category: 'ROUTINE', repeatable: true },
  { name: 'Go to the gym', category: 'ROUTINE', repeatable: true },
  { name: 'Go for a walk', category: 'ROUTINE', repeatable: true },
  { name: 'Tidy up for 10 minutes', category: 'ROUTINE', repeatable: true },
  { name: 'Drink a glass of water first thing', category: 'ROUTINE', repeatable: true },
  { name: 'Do the laundry', category: 'ROUTINE', repeatable: true },
  { name: 'Pay a bill', category: 'NECESSARY', repeatable: true },
  { name: 'Go food shopping', category: 'NECESSARY', repeatable: true },
  { name: 'Self care', category: 'NECESSARY', repeatable: true },
  { name: 'Book a doctors appointment', category: 'NECESSARY', repeatable: false },
  { name: 'Tax the car', category: 'NECESSARY', repeatable: false },
  { name: 'Apply for jobs', category: 'NECESSARY', repeatable: false },
  { name: 'Watch TV or a film', category: 'PLEASURABLE', repeatable: true },
  { name: 'Read a book', category: 'PLEASURABLE', repeatable: true },
  { name: 'Play a video game', category: 'PLEASURABLE', repeatable: true },
  { name: 'Take a long bath', category: 'PLEASURABLE', repeatable: true },
  { name: 'Play some music', category: 'PLEASURABLE', repeatable: true },
  { name: 'Call a friend', category: 'PLEASURABLE', repeatable: true },
  { name: 'Work on a personal project', category: 'PLEASURABLE', repeatable: true },
  { name: 'Go somewhere for coffee', category: 'PLEASURABLE', repeatable: false },
] as const
