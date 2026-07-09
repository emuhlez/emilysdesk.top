import type { PromptTemplate } from '../types'

export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  'scene-building': {
    name: 'Scene Building',
    systemPrefix:
      'Focus on creating and arranging 3D objects to build complete scenes. Proactively suggest object placements, groupings, and compositions. Think spatially about how objects relate to each other.',
    suggestedMessages: [
      'Build me a simple room with walls and a floor',
      'Create a forest clearing with trees',
      'Set up a basic city block',
    ],
  },
  'material-editing': {
    name: 'Material Editing',
    systemPrefix:
      'Focus on material properties: colors, metalness, roughness, transparency. Help the user achieve specific visual styles. Suggest complementary colors and realistic material combinations.',
    suggestedMessages: [
      'Make all objects look like polished metal',
      'Create a glass-like transparent sphere',
      'Apply a warm color palette to the scene',
    ],
  },
  'sketch-interpretation': {
    name: 'Sketch Interpretation',
    systemPrefix:
      'The user will send sketches/drawings. Interpret them as 3D scene layouts and create objects matching the sketch. Be creative in translating 2D drawings to 3D objects.',
    suggestedMessages: [
      'I\'ll draw what I want - ready to sketch',
      'Interpret my drawing as a top-down view',
      'Convert my sketch to 3D objects',
    ],
  },
}

export function getTemplate(name: string): PromptTemplate | undefined {
  return PROMPT_TEMPLATES[name]
}

export function listTemplates(): { id: string; name: string }[] {
  return Object.entries(PROMPT_TEMPLATES).map(([id, t]) => ({ id, name: t.name }))
}
