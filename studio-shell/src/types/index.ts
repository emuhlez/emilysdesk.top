export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface Transform {
  position: Vector3
  rotation: Vector3
  scale: Vector3
}

export type GameObjectType = 
  | 'empty'
  | 'mesh'
  | 'light'
  | 'camera'
  | 'audio'
  | 'sprite'
  | 'tilemap'
  | 'particle'
  | 'script'

export type TerrainBiome = 'grass' | 'desert' | 'snow' | 'rocky' | 'volcanic'

export interface TerrainData {
  width: number
  depth: number
  heightScale: number
  segments: number
  seed: number
  octaves: number
  biome: TerrainBiome
}

export interface GameObject {
  id: string
  name: string
  type: GameObjectType
  transform: Transform
  pivot?: { position: Vector3; rotation: Vector3 }
  visible: boolean
  locked: boolean
  children: string[]
  parentId: string | null
  components: Component[]
  /** Override texture source filename (e.g. from file picker) */
  texturePath?: string
  /** Object URL for user-selected mesh file (replaces asset from /3d-space) */
  meshUrl?: string
  /** Filename of user-selected mesh (e.g. "MyModel.glb") for display */
  meshFilename?: string
  /** Render fidelity: Automatic | Low | Medium | High */
  renderFidelity?: 'Automatic' | 'Low' | 'Medium' | 'High'
  /** Render both sides of mesh faces */
  doubleSided?: boolean
  /** Primitive geometry type for AI-created objects */
  primitiveType?: 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'plane' | 'terrain'
  /** Terrain generation parameters (only when primitiveType === 'terrain') */
  terrainData?: TerrainData
  /** Tint color (hex, e.g. #ffffff) */
  color?: string
  /** Material name (e.g. Plastic) */
  material?: string
  /** Reflectance 0–1 */
  reflectance?: number
  /** Roughness 0–1 (default 0.6) */
  roughness?: number
  /** Transparency 0–1 */
  transparency?: number
  /** Cast shadow */
  castShadow?: boolean
  /** Physics: anchored */
  anchored?: boolean
  /** Physics: can collide */
  canCollide?: boolean
  /** Physics: can touch */
  canTouch?: boolean
  /** Physics: collision group */
  collisionGroup?: string
  /** Physics: fluid forces */
  fluidForces?: boolean
  /** Physics: massless */
  massless?: boolean
  /** Import: source path */
  importPath?: string
  /** Import only as model */
  importOnlyAsModel?: boolean
  /** Upload to Roblox */
  uploadToRoblox?: boolean
  /** Import as package */
  importAsPackage?: boolean
  /** Rig type */
  rigType?: string
  /** World forward axis */
  worldForward?: string
  /** World up axis */
  worldUp?: string
  /** Scale unit */
  scaleUnit?: string
  /** Merge meshes */
  mergeMeshes?: boolean
}

export interface Component {
  id: string
  type: string
  enabled: boolean
  properties: Record<string, unknown>
}

export interface Asset {
  id: string
  name: string
  type: 'texture' | 'model' | 'audio' | 'video' | 'script' | 'material' | 'prefab' | 'scene' | 'folder' | 'animation'
  path: string
  thumbnail?: string
  children?: Asset[]
  assetId?: string
  dateModified?: string
}

export interface ConsoleMessage {
  id: string
  type: 'info' | 'warning' | 'error' | 'log'
  message: string
  timestamp: Date
  source?: string
}

export interface ViewportSelectedAsset {
  name: string
}

export interface EditorState {
  selectedObjectIds: string[]
  selectedAssetIds: string[]
  selectedAssetAnchor: string | null
  viewportSelectedAssetNames: string[]
  isPlaying: boolean
  isPaused: boolean
  activeTool: 'select' | 'move' | 'rotate' | 'scale'
  viewMode: '2d' | '3d'
  showGrid: boolean
  snapToGrid: boolean
  gridSize: number
}

export type DockZone = 'left' | 'center-top' | 'center-bottom' | 'right-top' | 'right-bottom'

export interface DockedWidget {
  id: string
  zone: DockZone
  order: number
  /** Sticky position on viewport (px from top-left of viewport area). When set, widget is placed here instead of a zone. */
  position?: { x: number; y: number }
}

// --- Conversation types ---

export type ConversationMode = 'default' | 'sketch'

export interface PersistedMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  textContent: string
  toolCalls?: { toolName: string; toolCallId?: string; args: Record<string, unknown>; result?: unknown }[]
  timestamp: number
  hasImage?: boolean
  isError?: boolean
}

export interface ConversationContext {
  mode: ConversationMode
  selectedObjectIds?: string[]
}

export interface Conversation {
  id: string
  title: string
  summary?: string
  createdAt: number
  updatedAt: number
  messages: PersistedMessage[]
  context?: ConversationContext
}

// --- Prompt template types ---

export interface PromptTemplate {
  name: string
  systemPrefix: string
  suggestedMessages: string[]
}

export interface PromptContext {
  sceneContext: string
  mode?: ConversationMode
  selectionContext?: string
  template?: PromptTemplate
  cameraContext?: string
  planModeHint?: 'questions' | 'todos' | null
}

// --- Plan types ---

export interface PlanTodo {
  label: string
  category?: string
}

export interface PlanQuestionOption {
  label: string
  description: string
}

export interface PlanQuestion {
  text: string
  placeholder?: string
  /** Category tab label: Scope, Mechanics, World, Style, Summary, etc. */
  category?: string
  /** Optional selectable option cards; user can also type their own answer. */
  options?: PlanQuestionOption[]
  /** When true, multiple options can be selected. Default: true (bias toward multi-select). */
  multiSelect?: boolean
}

export interface PlanData {
  todos: PlanTodo[]
  questions?: PlanQuestion[]
  answers?: string[]
  /** Original user prompt (e.g. from /plan command) used to generate todos after Q&A */
  prompt?: string
}

export type PlanStatus = 'pending' | 'approved' | 'rejected' | 'executing' | 'done' | 'clarifying' | 'reviewing' | 'answered' | 'step-paused'

export type ExecutionMode = 'one-shot' | 'step-by-step'

export type StepStatus = 'pending' | 'executing' | 'done' | 'error'

// --- PillInput types ---

/** Kind of pill for flexible tagging: scene objects, assets, asset types, collaborators, etc. */
export type PillKind = 'object' | 'asset' | 'assetType' | 'collaborator' | 'tool' | 'command' | 'script' | 'folder' | 'active-tab' | 'doc' | 'readme' | 'plan'

export type InputSegment =
  | { type: 'text'; text: string }
  | { type: 'pill'; kind: PillKind; id: string; label: string; objectType?: string }

export type PillPayload = { kind?: PillKind; id: string; label: string; objectType?: string }

export interface MentionQuery {
  query: string
  rect: DOMRect
}

export interface SlashCommandQuery {
  query: string
  rect: DOMRect
}

export interface PillInputHandle {
  insertPillsAtCursor: (pills: PillPayload[]) => void
  replaceMentionWithPill: (pill: PillPayload) => void
  replaceSlashCommand: (text: string) => void
  focus: () => void
  getTextContent: () => string
}

// --- Background task types ---

export type BackgroundTaskStatus = 'pending' | 'running' | 'done' | 'error'

export interface BackgroundTask {
  id: string
  command: string
  status: BackgroundTaskStatus
  createdAt: number
  completedAt?: number
  error?: string
  /** Conversation this task is associated with (e.g. when enqueued from assistant panel) */
  conversationId?: string
  /** One-line summary for drawer display (extracted from AI response) */
  summary?: string
  /** Full AI response text for expanded view */
  fullResponseText?: string
  /** Tool calls executed during this task */
  toolCalls?: { toolName: string; args: Record<string, unknown> }[]
  /** Result of auto-classification */
  classification?: 'task' | 'conversation'
  /** Whether drawer row is expanded to show full response */
  expanded?: boolean
  /** Associated conversation message IDs (for hiding/un-hiding) */
  messageIds?: string[]
  /** Meshy job ID for generation tasks */
  meshJobId?: string
  /** Meshy job type */
  meshJobType?: 'image-to-3d' | 'text-to-3d'
  /** Generation progress 0–100 */
  progress?: number
}

export type ImportQueueStatus = 'pending' | 'importing' | 'success' | 'error'

export interface ImportQueueItem {
  id: string
  file: File
  fileName: string
  filePath: string
  creator: string
  importPreset: string
  status: ImportQueueStatus
  assetType: Asset['type']
  progress?: number
  error?: string
}




