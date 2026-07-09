import type { Tool } from 'ai'

export class ToolRegistry {
  private tools: Record<string, Tool> = {}

  register(name: string, tool: Tool): void {
    this.tools[name] = tool
  }

  getTools(): Record<string, Tool> {
    return { ...this.tools }
  }

  getTool(name: string): Tool | undefined {
    return this.tools[name]
  }
}

export const toolRegistry = new ToolRegistry()
