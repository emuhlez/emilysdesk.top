export interface SlashCommand {
  id: string
  label: string
  description: string
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'generate', label: '/generate', description: 'Generate mesh assets using AI' },
  { id: 'generate_primitive', label: '/generate_primitive', description: 'Blocky style, fewer tokens, easily editable' },
  { id: 'generate_mesh', label: '/generate_mesh', description: 'Detailed, takes longer, high token usage' },
  { id: 'insert', label: '/insert', description: 'Insert an asset from the Creator Store' },
  { id: 'material', label: '/material', description: 'Create a material using the Material Editor' },
  { id: 'plan', label: '/plan', description: 'Create a plan for building your project' },
  { id: 'run', label: '/run', description: 'Run code in the command bar' },
  { id: 'script_create', label: '/script_create', description: 'Create a new script' },
  { id: 'script_run', label: '/script_run', description: 'Run a script' },
  { id: 'script_debug', label: '/script_debug', description: 'Debug a script' },
  { id: 'script_variables', label: '/script_variables', description: 'Manage script variables' },
  { id: 'demo', label: '/demo', description: 'Simulate an AI assistant response in the panel' },
]
