import { useChat } from '@ai-sdk/react'
import type { UIMessage } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useRef, useMemo, useEffect, useCallback, useState } from 'react'
import { useEditorStore } from '../store/editorStore'
import { usePlanStore } from '../store/planStore'
import { useConversationStore } from '../store/conversationStore'
import { serializeSceneContext, serializeSelectionContext, serializeCameraContext } from './scene-context'
import { executeTool } from './tool-executor'
import type { ConversationMode, PersistedMessage } from '../types'

/** Convert persisted messages back into UIMessage format so the AI SDK can render them. */
function persistedToUIMessages(messages: PersistedMessage[]): UIMessage[] {
  return messages.map((m) => {
    const parts: UIMessage['parts'] = []

    if (m.textContent) {
      parts.push({ type: 'text' as const, text: m.textContent })
    }

    if (m.toolCalls?.length) {
      for (const tc of m.toolCalls) {
        parts.push({
          type: `tool-${tc.toolName}`,
          toolCallId: tc.toolCallId ?? `tc-${m.id}-${tc.toolName}`,
          toolName: tc.toolName,
          state: 'output-available',
          input: tc.args ?? {},
          output: tc.result,
        } as unknown as UIMessage['parts'][number])
      }
    }

    if (parts.length === 0) {
      parts.push({ type: 'text' as const, text: '' })
    }

    return { id: m.id, role: m.role, parts }
  })
}

interface UseAgentChatOptions {
  conversationId?: string | null
  mode?: ConversationMode
}

export function useAgentChat(options?: UseAgentChatOptions) {
  const storeRef = useRef(useEditorStore.getState())

  useEffect(() => {
    const unsub = useEditorStore.subscribe((state) => {
      storeRef.current = state
    })
    return unsub
  }, [])

  const [activeConversationId, setActiveConversationId] = useState(
    () => useConversationStore.getState().activeConversationId
  )
  useEffect(() => {
    const unsubscribe = useConversationStore.subscribe((state) => {
      setActiveConversationId(state.activeConversationId)
    })
    return unsubscribe
  }, [])
  const mode = options?.mode

  const chatId = options?.conversationId ?? activeConversationId ?? 'agent-chat'
  const isBackgroundTasks = chatId === '__background-tasks__'

  const streamingConvRef = useRef<string | null>(null)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/agent/chat',
        body: () => {
          const state = storeRef.current
          const effectiveMode = mode ?? ((state.activeTool as string) === 'pen' ? 'sketch' : undefined)

          let cameraContext: string | undefined
          if (effectiveMode === 'sketch' && state.getCameraInfo) {
            const camInfo = state.getCameraInfo()
            if (camInfo) {
              cameraContext = serializeCameraContext(camInfo)
            }
          }

          const planState = usePlanStore.getState()
          const followUp = planState.pendingFollowUp
          if (followUp) {
            console.log('[useAgentChat] body() consuming pendingFollowUp:', followUp)
            planState.setPendingFollowUp(null)
          }

          return {
            sceneContext: serializeSceneContext(
              state.gameObjects,
              state.rootObjectIds
            ),
            selectionContext: serializeSelectionContext(
              state.gameObjects,
              state.selectedObjectIds
            ),
            mode: effectiveMode,
            cameraContext,
            background: isBackgroundTasks || undefined,
            forcePlanTodos: followUp === 'todos' || undefined,
            executingPlan: followUp === 'execute' || undefined,
          }
        },
      }),
    [chatId, mode, isBackgroundTasks]
  )

  const autoSendPendingRef = useRef(false)

  const chat = useChat({
    id: chatId,
    transport,
    sendAutomaticallyWhen: ({ messages }) => {
      const planState = usePlanStore.getState()
      if (planState.activePlan?.status !== 'executing') return false

      const lastMsg = messages[messages.length - 1]
      if (!lastMsg || lastMsg.role !== 'assistant') return false
      const parts = lastMsg.parts ?? []
      const hasToolOutput = parts.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => p.state === 'output-available'
      )
      const hasPendingTool = parts.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => p.state === 'input-available' || p.state === 'input-streaming'
      )
      return hasToolOutput && !hasPendingTool
    },
    onToolCall: ({ toolCall }) => {
      console.log('[useAgentChat] onToolCall:', toolCall.toolName, toolCall.input)
      try {
        const result = executeTool(
          toolCall.toolName,
          toolCall.input as Record<string, unknown>,
          toolCall.toolCallId
        )
        console.log('[useAgentChat] tool result:', toolCall.toolName, result)
        return result as void
      } catch (err) {
        console.error('[useAgentChat] tool execution error:', toolCall.toolName, err)
        return undefined as void
      }
    },
    onFinish: ({ message }) => {
      if (!isBackgroundTasks) {
        const es = useEditorStore.getState()
        es.setAiGenerating(false)
        es.setAiWorkingObjectIds(new Set())
      }
      if (streamingConvRef.current) {
        useConversationStore.getState().markReady(streamingConvRef.current)
        streamingConvRef.current = null
      }

      if (isBackgroundTasks) return
      const convStore = useConversationStore.getState()
      const convId = options?.conversationId ?? convStore.activeConversationId
      if (!convId || !convStore.conversations[convId]) return

      const textContent = message.parts
        ?.filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
        .map((p) => p.text)
        .join('') || ''

      const toolCalls = message.parts
        ?.filter((p) => p.type.startsWith('tool-'))
        .map((p) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const part = p as any
          return {
            toolName: part.type.slice(5) as string,
            toolCallId: (part.toolCallId as string) ?? undefined,
            args: (part.input ?? {}) as Record<string, unknown>,
            result: part.output,
          }
        })

      const persisted: PersistedMessage = {
        id: message.id,
        role: 'assistant',
        textContent,
        toolCalls: toolCalls?.length ? toolCalls : undefined,
        timestamp: Date.now(),
      }

      convStore.addMessage(convId, persisted)

      const conv = convStore.conversations[convId]
      if (conv && !conv.summary && conv.messages.length >= 3) {
        fetch('/api/agent/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: conv.messages.slice(0, 10) }),
        })
          .then((r) => r.ok ? r.json() : null)
          .then((data) => {
            if (data?.summary) {
              useConversationStore.getState().setSummary(convId, data.summary)
            }
          })
          .catch(() => {})
      }
    },
    onError: (error) => {
      if (!isBackgroundTasks) {
        const es = useEditorStore.getState()
        es.setAiGenerating(false)
        es.setAiWorkingObjectIds(new Set())
      }
      if (streamingConvRef.current) {
        useConversationStore.getState().markReady(streamingConvRef.current)
        streamingConvRef.current = null
      }
      console.error('[useAgentChat] onError:', error)
      useEditorStore.getState().log(
        `AI Error: ${error.message}`,
        'error',
        'AI Agent'
      )

      if (!isBackgroundTasks) {
        const convStore = useConversationStore.getState()
        const convId = options?.conversationId ?? convStore.activeConversationId
        if (convId && convStore.conversations[convId]) {
          convStore.addMessage(convId, {
            id: `error-${Date.now()}`,
            role: 'assistant',
            textContent: error.message || 'Something went wrong. Please try again.',
            timestamp: Date.now(),
            isError: true,
          })
        }
      }
    },
  })

  useEffect(() => {
    if (chat.status === 'submitted') {
      autoSendPendingRef.current = true
    } else if (chat.status === 'ready') {
      autoSendPendingRef.current = false
    }
  }, [chat.status])

  const convIdForStreaming = options?.conversationId ?? activeConversationId
  useEffect(() => {
    if (isBackgroundTasks || !convIdForStreaming) return
    const convStore = useConversationStore.getState()
    const isStreaming = chat.status === 'streaming' || chat.status === 'submitted'
    if (isStreaming) {
      streamingConvRef.current = convIdForStreaming
      convStore.markStreaming(convIdForStreaming)
    } else {
      convStore.markReady(convIdForStreaming)
      if (streamingConvRef.current === convIdForStreaming) {
        streamingConvRef.current = null
      }
    }
  }, [chat.status, convIdForStreaming, isBackgroundTasks])

  const prevChatIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (isBackgroundTasks) return
    if (prevChatIdRef.current === chatId) return
    prevChatIdRef.current = chatId

    if (chat.messages.length > 0) return

    const convStore = useConversationStore.getState()
    const convId = options?.conversationId ?? convStore.activeConversationId
    if (!convId) return
    const conv = convStore.conversations[convId]
    if (!conv || conv.messages.length === 0) return

    chat.setMessages(persistedToUIMessages(conv.messages))
  }, [chatId, isBackgroundTasks, chat.messages.length, chat.setMessages, options?.conversationId])

  const sendMessage = useCallback(
    (params?: Parameters<typeof chat.sendMessage>[0]) => {
      if (!isBackgroundTasks) {
        const convStore = useConversationStore.getState()
        let convId = options?.conversationId ?? convStore.activeConversationId

        if (!convId || !convStore.conversations[convId]) {
          convId = convStore.createConversation()
        }

        if (convId && params) {
          const text = typeof params === 'string'
            ? params
            : 'text' in params
              ? (params as { text: string }).text
              : ''

          if (text && /\b(resume|continue|keep)\b.*\b(build|going|executing|task)\b/i.test(text)) {
            const planState = usePlanStore.getState()
            if (planState.activePlan?.status === 'done') {
              console.log('[useAgentChat] Resume intent detected — re-entering execution mode')
              planState.resumeExecution()
              planState.setPendingFollowUp('execute')
            }
          }

          const hasImage = typeof params === 'object' && params !== null && 'parts' in params
            ? ((params as { parts?: Array<{ type: string }> }).parts)?.some((p) => p.type === 'file')
            : false

          const persisted: PersistedMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            textContent: text || '',
            timestamp: Date.now(),
            hasImage: hasImage || undefined,
          }
          convStore.addMessage(convId, persisted)
        }
      }

      return chat.sendMessage(params)
    },
    [chat, isBackgroundTasks, options?.conversationId]
  )

  return {
    ...chat,
    sendMessage,
    conversationId: chatId,
    autoSendPendingRef,
  }
}
