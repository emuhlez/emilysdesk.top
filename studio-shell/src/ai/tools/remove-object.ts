import { useEditorStore } from '../../store/editorStore'

export interface RemoveObjectArgs {
  id: string
}

export function executeRemoveObject(args: RemoveObjectArgs): { removed: boolean; id: string } {
  const store = useEditorStore.getState()
  const obj = store.gameObjects[args.id]

  if (!obj) {
    store.log(`AI: Object not found (id: ${args.id})`, 'warning', 'AI Agent')
    return { removed: false, id: args.id }
  }

  const name = obj.name
  store.deleteGameObject(args.id)
  store.log(`AI: Removed "${name}"`, 'info', 'AI Agent')

  return { removed: true, id: args.id }
}
