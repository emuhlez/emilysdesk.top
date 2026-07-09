import { useState, useEffect, useRef } from 'react'

const SUGGESTIONS: string[] = [
  'make a tree with low-poly style',
  'make a house with a red roof',
  'make a car',
  'make the terrain more hilly',
  'add a spotlight above the scene',
  'add a campfire with warm lighting',
  'add trees around the perimeter',
  'create a stone wall around the area',
  'create a wooden bridge',
  'create a simple character',
  'change the material to wood',
  'change the color to blue',
  'change the lighting to sunset',
  'delete all objects',
  'duplicate the selected object',
  'move it to the left',
  'move it up by 2 units',
  'rotate it 90 degrees',
  'scale it down to half size',
  'group these objects together',
  'rename this to "Main Building"',
  'generate a wooden chair',
  'generate a low-poly sword',
  'generate a medieval castle',
  'generate a sci-fi spaceship',
  'generate a tree',
]

/**
 * Returns a predictive suggestion based on the current input text.
 * Matches from a list of common prompts, returning the untyped remainder.
 */
export function usePredictiveText(text: string): {
  suggestion: string | undefined
  acceptSuggestion: () => string
} {
  const [suggestion, setSuggestion] = useState<string | undefined>(undefined)
  const matchedRef = useRef<string>('')

  useEffect(() => {
    const trimmed = text.trim().toLowerCase()
    if (trimmed.length < 3) {
      setSuggestion(undefined)
      matchedRef.current = ''
      return
    }

    // Find first suggestion that starts with the typed text
    const match = SUGGESTIONS.find((s) => s.startsWith(trimmed) && s !== trimmed)
    if (match) {
      const remainder = match.slice(trimmed.length)
      setSuggestion(remainder)
      matchedRef.current = match
    } else {
      setSuggestion(undefined)
      matchedRef.current = ''
    }
  }, [text])

  const acceptSuggestion = () => {
    const full = matchedRef.current
    setSuggestion(undefined)
    matchedRef.current = ''
    return full
  }

  return { suggestion, acceptSuggestion }
}
