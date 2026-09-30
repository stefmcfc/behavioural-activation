import type { ActivityCategory } from '../types/activity'

export interface CategoryGuidanceEntry {
  readonly purpose: string
  readonly example: string
}

export const CATEGORY_GUIDANCE: Record<ActivityCategory, CategoryGuidanceEntry> = {
  ROUTINE: {
    purpose:
      "Something you do as a regular habit or part of your normal rhythm — done because it's " +
      'routine, not because it’s urgent or especially enjoyable.',
    example: 'A daily walk you always take.',
  },
  NECESSARY: {
    purpose:
      'Something that needs doing regardless of how it feels — driven by obligation or ' +
      'practical need.',
    example: 'Cooking dinner because food is needed.',
  },
  PLEASURABLE: {
    purpose:
      "Something you do mainly because it's enjoyable or rewarding, not because it's routine " +
      'or required.',
    example: 'Trying a new recipe because it sounds fun.',
  },
}
