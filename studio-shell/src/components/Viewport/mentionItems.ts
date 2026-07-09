import type { MentionItem } from '../shared/MentionDropdown'

/** Static script stubs — shown when no scene scripts exist yet */
export const MENTION_SCRIPTS: MentionItem[] = [
  { id: 'script-new', label: 'New Script', kind: 'script', category: 'script' },
]

/** All docs grouped under a single "Docs" category — README, planning, and API reference */
export const MENTION_READMES: MentionItem[] = [
  { id: 'readme-project', label: 'README', kind: 'readme', category: 'doc' },
  { id: 'readme-getting-started', label: 'Getting Started', kind: 'readme', category: 'doc' },
  { id: 'readme-architecture', label: 'Architecture', kind: 'readme', category: 'doc' },
  { id: 'readme-contributing', label: 'Contributing', kind: 'readme', category: 'doc' },
  { id: 'readme-changelog', label: 'Changelog', kind: 'readme', category: 'doc' },
]

export const MENTION_PLANS: MentionItem[] = [
  { id: 'plan-gdd', label: 'Game Design Document', kind: 'plan', category: 'doc' },
  { id: 'plan-level', label: 'Level Design Plan', kind: 'plan', category: 'doc' },
  { id: 'plan-assets', label: 'Asset Plan', kind: 'plan', category: 'doc' },
  { id: 'plan-systems', label: 'Systems Design', kind: 'plan', category: 'doc' },
  { id: 'plan-roadmap', label: 'Roadmap', kind: 'plan', category: 'doc' },
  { id: 'plan-sprint', label: 'Sprint Plan', kind: 'plan', category: 'doc' },
]

