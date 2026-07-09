import type { PlanTodo, PlanQuestion } from '../../types'
import type { ToolCall } from './parsers'

export interface RecipeStep {
  toolCalls: ToolCall[]
}

export interface Recipe {
  patterns: RegExp[]
  todos: PlanTodo[]
  steps: RecipeStep[]
  /** Clarifying questions to show before the todo list. If present, questions flow runs first. */
  questions?: PlanQuestion[]
}

// --- Recipe registry: planId → steps ---
const recipeStepRegistry = new Map<string, RecipeStep[]>()

export function registerRecipeSteps(planId: string, steps: RecipeStep[]): void {
  recipeStepRegistry.set(planId, steps)
}

export function getRecipeSteps(planId: string): RecipeStep[] | undefined {
  return recipeStepRegistry.get(planId)
}

export function clearRecipeSteps(planId: string): void {
  recipeStepRegistry.delete(planId)
}

// ---------------------------------------------------------------------------
// CASTLE
// ---------------------------------------------------------------------------
const castleRecipe: Recipe = {
  patterns: [/\bcastle\b/i, /\bfortress\b/i, /\bcitadel\b/i, /\bstronghold\b/i],
  todos: [
    { label: 'Build corner towers', category: 'Structure' },
    { label: 'Build castle walls', category: 'Structure' },
    { label: 'Build gate and entrance', category: 'Structure' },
    { label: 'Build central keep', category: 'Structure' },
    { label: 'Add tower roofs', category: 'Detail' },
    { label: 'Add battlements', category: 'Detail' },
  ],
  steps: [
    // Step 0: Corner towers — squat box towers
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Tower NW', primitive: 'box', position: [-6, 3, -6], scale: [2, 6, 2], color: '#808080' } },
        { toolName: 'addObject', args: { name: 'Tower NE', primitive: 'box', position: [6, 3, -6], scale: [2, 6, 2], color: '#808080' } },
        { toolName: 'addObject', args: { name: 'Tower SW', primitive: 'box', position: [-6, 3, 6], scale: [2, 6, 2], color: '#808080' } },
        { toolName: 'addObject', args: { name: 'Tower SE', primitive: 'box', position: [6, 3, 6], scale: [2, 6, 2], color: '#808080' } },
      ],
    },
    // Step 1: Walls
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'North Wall', primitive: 'box', position: [0, 2.5, -6], scale: [12, 5, 0.5], color: '#808080' } },
        { toolName: 'addObject', args: { name: 'South Wall', primitive: 'box', position: [0, 2.5, 6], scale: [12, 5, 0.5], color: '#808080' } },
        { toolName: 'addObject', args: { name: 'East Wall', primitive: 'box', position: [6, 2.5, 0], scale: [0.5, 5, 12], color: '#808080' } },
        { toolName: 'addObject', args: { name: 'West Wall', primitive: 'box', position: [-6, 2.5, 0], scale: [0.5, 5, 12], color: '#808080' } },
      ],
    },
    // Step 2: Gate
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Gate Left', primitive: 'box', position: [-1.5, 2.5, -6], scale: [1, 5, 0.8], color: '#6b4226' } },
        { toolName: 'addObject', args: { name: 'Gate Right', primitive: 'box', position: [1.5, 2.5, -6], scale: [1, 5, 0.8], color: '#6b4226' } },
        { toolName: 'addObject', args: { name: 'Gate Arch', primitive: 'box', position: [0, 4.5, -6], scale: [3, 1, 0.8], color: '#6b4226' } },
      ],
    },
    // Step 3: Keep
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Castle Keep', primitive: 'box', position: [0, 3, 0], scale: [4, 6, 4], color: '#707070' } },
      ],
    },
    // Step 4: Tower roofs
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Roof NW', primitive: 'cone', position: [-6, 7, -6], scale: [2, 2, 2], color: '#8b0000' } },
        { toolName: 'addObject', args: { name: 'Roof NE', primitive: 'cone', position: [6, 7, -6], scale: [2, 2, 2], color: '#8b0000' } },
        { toolName: 'addObject', args: { name: 'Roof SW', primitive: 'cone', position: [-6, 7, 6], scale: [2, 2, 2], color: '#8b0000' } },
        { toolName: 'addObject', args: { name: 'Roof SE', primitive: 'cone', position: [6, 7, 6], scale: [2, 2, 2], color: '#8b0000' } },
      ],
    },
    // Step 5: Battlements
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Battlement N1', primitive: 'box', position: [-3, 5.5, -6], scale: [1, 1, 0.6], color: '#808080' } },
        { toolName: 'addObject', args: { name: 'Battlement N2', primitive: 'box', position: [0, 5.5, -6], scale: [1, 1, 0.6], color: '#808080' } },
        { toolName: 'addObject', args: { name: 'Battlement N3', primitive: 'box', position: [3, 5.5, -6], scale: [1, 1, 0.6], color: '#808080' } },
        { toolName: 'addObject', args: { name: 'Keep Roof', primitive: 'cone', position: [0, 7, 0], scale: [3, 2, 3], color: '#8b0000' } },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// HOUSE
// ---------------------------------------------------------------------------
const houseRecipe: Recipe = {
  patterns: [/\bhouse\b/i, /\bhome\b/i, /\bcabin\b/i, /\bcottage\b/i, /\bbungalow\b/i],
  todos: [
    { label: 'Build walls', category: 'Structure' },
    { label: 'Add roof', category: 'Structure' },
    { label: 'Add door', category: 'Detail' },
    { label: 'Add windows', category: 'Detail' },
  ],
  steps: [
    // Step 0: Walls
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'House Walls', primitive: 'box', position: [0, 1.5, 0], scale: [4, 3, 3], color: '#deb887' } },
      ],
    },
    // Step 1: Roof
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'House Roof', primitive: 'box', position: [0, 3.3, 0], scale: [4.5, 0.3, 3.5], color: '#8b4513' } },
        { toolName: 'addObject', args: { name: 'Roof Peak', primitive: 'box', position: [0, 3.8, 0], scale: [3.5, 0.3, 2.5], color: '#8b4513' } },
      ],
    },
    // Step 2: Door
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Door', primitive: 'box', position: [0, 0.9, -1.55], scale: [0.8, 1.8, 0.1], color: '#6b4226' } },
      ],
    },
    // Step 3: Windows
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Window Left', primitive: 'box', position: [-1.2, 1.8, -1.55], scale: [0.6, 0.6, 0.1], color: '#87ceeb' } },
        { toolName: 'addObject', args: { name: 'Window Right', primitive: 'box', position: [1.2, 1.8, -1.55], scale: [0.6, 0.6, 0.1], color: '#87ceeb' } },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// TREE
// ---------------------------------------------------------------------------
const treeRecipe: Recipe = {
  patterns: [/\btree\b/i, /\boak\b/i, /\bpine\b/i],
  todos: [
    { label: 'Create trunk', category: 'Structure' },
    { label: 'Add canopy', category: 'Detail' },
  ],
  steps: [
    // Step 0: Trunk — use box for a blocky, non-cylindrical trunk
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Tree Trunk', primitive: 'box', position: [0, 1, 0], scale: [0.6, 2, 0.6], color: '#8b6914' } },
      ],
    },
    // Step 1: Canopy — large spheres that overlap the trunk top
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Canopy Lower', primitive: 'sphere', position: [0, 2.8, 0], scale: [3, 2, 3], color: '#228b22' } },
        { toolName: 'addObject', args: { name: 'Canopy Upper', primitive: 'sphere', position: [0, 3.8, 0], scale: [2.2, 1.8, 2.2], color: '#2e8b57' } },
        { toolName: 'addObject', args: { name: 'Canopy Side', primitive: 'sphere', position: [0.8, 3, 0.5], scale: [1.5, 1.3, 1.5], color: '#228b22' } },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// TOWER
// ---------------------------------------------------------------------------
const towerRecipe: Recipe = {
  patterns: [/\btower\b/i, /\bturret\b/i, /\blighthouse\b/i, /\bspire\b/i],
  todos: [
    { label: 'Build tower base', category: 'Structure' },
    { label: 'Build tower upper section', category: 'Structure' },
    { label: 'Add cone roof', category: 'Detail' },
    { label: 'Add parapet ring', category: 'Detail' },
  ],
  steps: [
    // Base — wider, squat box
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Tower Base', primitive: 'box', position: [0, 1.5, 0], scale: [3, 3, 3], color: '#808080' } },
      ],
    },
    // Upper section — narrower box stacked on base
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Tower Upper', primitive: 'box', position: [0, 4.5, 0], scale: [2.5, 3, 2.5], color: '#808080' } },
      ],
    },
    // Roof
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Tower Roof', primitive: 'cone', position: [0, 7, 0], scale: [3, 2, 3], color: '#8b0000' } },
      ],
    },
    // Parapet ring
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Parapet', primitive: 'torus', position: [0, 6, 0], scale: [1.8, 0.3, 1.8], color: '#707070' } },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// BRIDGE
// ---------------------------------------------------------------------------
const bridgeRecipe: Recipe = {
  patterns: [/\bbridge\b/i, /\boverpass\b/i],
  todos: [
    { label: 'Build deck', category: 'Structure' },
    { label: 'Add supports', category: 'Structure' },
    { label: 'Add railings', category: 'Detail' },
  ],
  steps: [
    // Deck
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Bridge Deck', primitive: 'box', position: [0, 3, 0], scale: [10, 0.3, 2], color: '#8b6914' } },
      ],
    },
    // Supports — wide box piers
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Support Left', primitive: 'box', position: [-3, 1.5, 0], scale: [0.8, 3, 0.8], color: '#808080' } },
        { toolName: 'addObject', args: { name: 'Support Right', primitive: 'box', position: [3, 1.5, 0], scale: [0.8, 3, 0.8], color: '#808080' } },
      ],
    },
    // Railings
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Railing Left', primitive: 'box', position: [0, 3.5, -0.9], scale: [10, 0.5, 0.1], color: '#6b4226' } },
        { toolName: 'addObject', args: { name: 'Railing Right', primitive: 'box', position: [0, 3.5, 0.9], scale: [10, 0.5, 0.1], color: '#6b4226' } },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// OBBY / OBSTACLE COURSE
// ---------------------------------------------------------------------------
const obbyRecipe: Recipe = {
  patterns: [/\bobby\b/i, /\bobstacle\s*course\b/i, /\bparkour\b/i, /\bjump\s*course\b/i],
  questions: [
    {
      text: 'What visual style should the obby have?',
      category: 'Style',
      options: [
        { label: 'Neon', description: 'Glowing platforms, dark background, bright trails' },
        { label: 'Natural', description: 'Grass, rocks, waterfalls, and sky islands' },
        { label: 'Cartoon', description: 'Bright colors, rounded shapes, playful props' },
      ],
    },
    {
      text: 'How difficult should the course be?',
      category: 'Scope',
      multiSelect: false,
      options: [
        { label: 'Easy', description: 'Wide platforms, short gaps, no moving parts' },
        { label: 'Medium', description: 'Smaller platforms, some moving obstacles' },
        { label: 'Hard', description: 'Tight jumps, kill bricks, spinners and timing walls' },
      ],
    },
    {
      text: 'What obstacle types do you want?',
      category: 'Obstacles',
      options: [
        { label: 'Platforms', description: 'Static and moving jump platforms' },
        { label: 'Kill bricks', description: 'Red parts that reset the player on touch' },
        { label: 'Spinners', description: 'Rotating bars the player must dodge' },
        { label: 'Wall jumps', description: 'Narrow walls requiring wall-jump technique' },
      ],
    },
    {
      text: 'How many stages should the obby have?',
      category: 'Layout',
      multiSelect: false,
      options: [
        { label: '5 stages', description: 'Quick course, good for a demo' },
        { label: '10 stages', description: 'Standard length with checkpoints' },
        { label: '20 stages', description: 'Full experience with progressive difficulty' },
      ],
    },
  ],
  todos: [
    { label: 'Build start platform', category: 'Layout' },
    { label: 'Add jumping platforms', category: 'Layout' },
    { label: 'Add tall platform', category: 'Layout' },
    { label: 'Add narrow beam section', category: 'Challenge' },
    { label: 'Build finish platform', category: 'Layout' },
    { label: 'Add checkpoint markers', category: 'Detail' },
  ],
  steps: [
    // Start
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Start Platform', primitive: 'box', position: [0, 0.5, 0], scale: [3, 1, 3], color: '#00ff00' } },
      ],
    },
    // Jumping platforms
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Platform 1', primitive: 'box', position: [4, 1, 0], scale: [2, 0.5, 2], color: '#4488ff' } },
        { toolName: 'addObject', args: { name: 'Platform 2', primitive: 'box', position: [8, 1.5, 2], scale: [2, 0.5, 2], color: '#4488ff' } },
        { toolName: 'addObject', args: { name: 'Platform 3', primitive: 'box', position: [12, 2, 0], scale: [2, 0.5, 2], color: '#4488ff' } },
      ],
    },
    // Tall platform
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Tall Platform', primitive: 'box', position: [16, 3, 0], scale: [2, 0.5, 2], color: '#ff8800' } },
      ],
    },
    // Narrow beam
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Narrow Beam', primitive: 'box', position: [22, 3, 0], scale: [8, 0.3, 0.5], color: '#ffff00' } },
      ],
    },
    // Finish
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Finish Platform', primitive: 'box', position: [28, 3, 0], scale: [3, 1, 3], color: '#ff0000' } },
      ],
    },
    // Checkpoints (flag markers: short post + flag box)
    {
      toolCalls: [
        { toolName: 'addObject', args: { name: 'Checkpoint Post 1', primitive: 'box', position: [8, 2.5, 2], scale: [0.15, 1, 0.15], color: '#cccccc' } },
        { toolName: 'addObject', args: { name: 'Checkpoint Flag 1', primitive: 'box', position: [8.4, 2.8, 2], scale: [0.6, 0.4, 0.1], color: '#ffff00' } },
        { toolName: 'addObject', args: { name: 'Checkpoint Post 2', primitive: 'box', position: [16, 4.5, 0], scale: [0.15, 1, 0.15], color: '#cccccc' } },
        { toolName: 'addObject', args: { name: 'Checkpoint Flag 2', primitive: 'box', position: [16.4, 4.8, 0], scale: [0.6, 0.4, 0.1], color: '#ffff00' } },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// ALL RECIPES
// ---------------------------------------------------------------------------
export const ALL_RECIPES: Recipe[] = [
  castleRecipe,
  houseRecipe,
  treeRecipe,
  towerRecipe,
  bridgeRecipe,
  obbyRecipe,
]

/** Find a matching recipe for the given text. */
export function matchRecipe(text: string): Recipe | null {
  for (const recipe of ALL_RECIPES) {
    for (const pattern of recipe.patterns) {
      if (pattern.test(text)) return recipe
    }
  }
  return null
}
