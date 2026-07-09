import { useEffect, useRef } from 'react'
import { useBackgroundTaskStore } from '../store/backgroundTaskStore'
import { useConversationStore } from '../store/conversationStore'
import { useDockingStore } from '../store/dockingStore'
import { useEditorStore } from '../store/editorStore'
import { processCommand } from './keyword-engine'
import { executeTool } from './tool-executor'
import { executeGenerateMesh } from './tools/generate-mesh'
import { stripLeadingBrackets } from './strip-brackets'
import type { PersistedMessage } from '../types'

/** Add assistant response to an existing conversation, or create a new one. */
function saveTaskToConversation(
  command: string,
  responseText: string,
  existingConvId?: string,
  toolCalls?: PersistedMessage['toolCalls'],
): string {
  const convStore = useConversationStore.getState()

  if (existingConvId && convStore.conversations[existingConvId]) {
    if (responseText || toolCalls?.length) {
      convStore.addMessage(existingConvId, {
        id: `assistant-task-${Date.now()}`,
        role: 'assistant',
        textContent: responseText,
        toolCalls: toolCalls?.length ? toolCalls : undefined,
        timestamp: Date.now(),
      })
    }
    return existingConvId
  }

  const cleanCommand = stripLeadingBrackets(command)
  const title = cleanCommand.slice(0, 40) + (cleanCommand.length > 40 ? '...' : '')
  const convId = convStore.createConversation(title)

  convStore.addMessage(convId, {
    id: `user-task-${Date.now()}`,
    role: 'user',
    textContent: command,
    timestamp: Date.now(),
  })

  if (responseText || toolCalls?.length) {
    convStore.addMessage(convId, {
      id: `assistant-task-${Date.now()}`,
      role: 'assistant',
      textContent: responseText,
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      timestamp: Date.now(),
    })
  }

  return convId
}

/** Clear viewport generating indicators when no tasks remain. */
function clearGeneratingIfIdle() {
  const remaining = useBackgroundTaskStore.getState().tasks
  if (!remaining.some((t) => t.status === 'running' || t.status === 'pending')) {
    const es = useEditorStore.getState()
    es.setAiGenerating(false)
    es.setAiWorkingObjectIds(new Set())
  }
}

export function useBackgroundTaskRunner() {
  const tasks = useBackgroundTaskStore((s) => s.tasks)
  const runningRef = useRef(false)

  const hasRunning = tasks.some((t) => t.status === 'running')

  useEffect(() => {
    if (runningRef.current) return
    const pending = useBackgroundTaskStore.getState().getNextPending()
    if (!pending) return

    runningRef.current = true
    useBackgroundTaskStore.getState().startTask(pending.id)

    const editorState = useEditorStore.getState()
    const sceneContext = {
      gameObjects: editorState.gameObjects,
      selectedObjectIds: editorState.selectedObjectIds,
      rootObjectIds: editorState.rootObjectIds,
    }

    try {
      const planMatch = pending.command.match(/^\/?plan\s*(.*)/i)
      if (planMatch) {
        const prompt = planMatch[1]?.trim() || 'New project'
        const planId = `plan-${Date.now()}`
        const questions = [
          {
            text: 'What visual style are you going for?',
            category: 'Style',
            options: [
              { label: 'Realistic', description: 'Detailed, natural-looking materials and lighting' },
              { label: 'Stylized', description: 'Exaggerated shapes, vibrant colors, cartoon-like' },
              { label: 'Low-poly', description: 'Minimal geometry, flat shading, clean aesthetic' },
            ],
          },
          {
            text: 'How complex should this be?',
            category: 'Scope',
            multiSelect: false,
            options: [
              { label: 'Simple', description: 'A few key objects, quick to build' },
              { label: 'Medium', description: 'Multiple elements with some detail' },
              { label: 'Elaborate', description: 'Many objects, rich detail, fully fleshed out' },
            ],
          },
          {
            text: 'What elements should be included?',
            category: 'Features',
            options: [
              { label: 'Terrain', description: 'Ground, hills, landscape features' },
              { label: 'Structures', description: 'Buildings, walls, architectural elements' },
              { label: 'Props', description: 'Decorative objects, furniture, small details' },
              { label: 'Lighting', description: 'Light sources, atmosphere, mood' },
            ],
          },
        ]
        const todos: { label: string; category?: string }[] = []
        const planToolCall = {
          toolName: 'createPlan',
          toolCallId: planId,
          args: { todos, questions, prompt } as Record<string, unknown>,
          result: { status: 'questions_asked', questionCount: questions.length },
        }
        executeTool('createPlan', { todos, questions, prompt }, planId)

        saveTaskToConversation(
          pending.command,
          `Let me ask a few questions to plan out: ${prompt}`,
          pending.conversationId,
          [planToolCall],
        )
        useBackgroundTaskStore.getState().dismissTask(pending.id)
        useDockingStore.getState().setAiAssistantBodyCollapsed(false)
        if (!useDockingStore.getState().widgets['ai-assistant']) {
          useDockingStore.getState().dockWidget('ai-assistant', 'right-top')
        }

        runningRef.current = false
        clearGeneratingIfIdle()
        return
      }

      const generateMatch = pending.command.match(/^\/?generate(?:_(mesh|primitive))?\s+([\s\S]+)/i)
      if (generateMatch) {
        const variant = generateMatch[1]?.toLowerCase()
        let promptText = generateMatch[2]!.trim()

        let imageDataUrl: string | undefined
        const imageMatch = promptText.match(/^\[IMAGE:(data:[^\]]+)\]\s*/)
        if (imageMatch) {
          imageDataUrl = imageMatch[1]
          promptText = promptText.slice(imageMatch[0].length).trim() || 'Generate from image'
        }

        // Map variant to Meshy model_type — both currently use default
        const modelType = variant === 'primitive' ? 'default' : 'default'

        const name = promptText.slice(0, 40)

        executeGenerateMesh({
          prompt: promptText,
          name,
          model_type: modelType,
          image_data_url: imageDataUrl,
        }).then(() => {
          saveTaskToConversation(
            pending.command,
            `Starting generation: ${name}`,
            pending.conversationId,
          )
          useBackgroundTaskStore.getState().dismissTask(pending.id)
        }).catch((err) => {
          console.error('[BackgroundTaskRunner] generate error:', err)
          useBackgroundTaskStore.getState().failTask(
            pending.id,
            err instanceof Error ? err.message : 'Generation failed',
          )
        })

        runningRef.current = false
        clearGeneratingIfIdle()
        return
      }

      const result = processCommand(pending.command, sceneContext)

      if (result.isPlan && result.plan) {
        if (result.isQuestions && result.plan.questions?.length) {
          const planToolCall = {
            toolName: 'createPlan',
            toolCallId: result.plan.id,
            args: { todos: result.plan.todos, questions: result.plan.questions } as Record<string, unknown>,
            result: { status: 'questions_asked', questionCount: result.plan.questions.length },
          }
          executeTool('createPlan', { todos: result.plan.todos, questions: result.plan.questions }, result.plan.id)

          saveTaskToConversation(
            pending.command,
            result.responseText,
            pending.conversationId,
            [planToolCall],
          )
          useBackgroundTaskStore.getState().dismissTask(pending.id)
          useDockingStore.getState().setAiAssistantBodyCollapsed(false)
        } else {
          const planToolCall = {
            toolName: 'createPlan',
            toolCallId: result.plan.id,
            args: { todos: result.plan.todos } as Record<string, unknown>,
            result: { status: 'plan_created', todoCount: result.plan.todos.length },
          }
          executeTool('createPlan', { todos: result.plan.todos }, result.plan.id)

          saveTaskToConversation(
            pending.command,
            result.responseText,
            pending.conversationId,
            [planToolCall],
          )
          useBackgroundTaskStore.getState().dismissTask(pending.id)
          useDockingStore.getState().setAiAssistantBodyCollapsed(false)
        }
      } else {
        const executedToolCalls: { toolName: string; args: Record<string, unknown> }[] = []
        for (const tc of result.toolCalls) {
          try {
            executeTool(tc.toolName, tc.args)
            executedToolCalls.push({ toolName: tc.toolName, args: tc.args })
          } catch (err) {
            console.error('[BackgroundTaskRunner] tool error:', tc.toolName, err)
          }
        }

        if (pending.conversationId) {
          saveTaskToConversation(
            pending.command,
            result.responseText,
            pending.conversationId,
          )
        }

        useBackgroundTaskStore.getState().classifyAndComplete(pending.id, {
          classification: 'task',
          summary: result.responseText,
          fullResponseText: result.responseText,
          toolCalls: executedToolCalls,
          messageIds: [],
        })
      }
    } catch (err) {
      console.error('[BackgroundTaskRunner] command processing error:', err)
      useBackgroundTaskStore.getState().failTask(
        pending.id,
        err instanceof Error ? err.message : 'Command processing failed',
      )
    }

    runningRef.current = false
    clearGeneratingIfIdle()
  }, [tasks])

  useEffect(() => {
    const cancelled = tasks.find((t) => t.status === 'error' && t.error === 'Cancelled by user')
    if (cancelled) {
      clearGeneratingIfIdle()
    }
  }, [tasks])

  return {
    isRunning: hasRunning || runningRef.current,
  }
}
