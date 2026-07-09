const MARKER = '[OPEN_ASSISTANT]'

export function parseResponse(text: string): { text: string; shouldOpenAssistant: boolean } {
  if (text.includes(MARKER)) {
    return {
      text: text.split(MARKER).join('').trim(),
      shouldOpenAssistant: true,
    }
  }
  return { text, shouldOpenAssistant: false }
}
