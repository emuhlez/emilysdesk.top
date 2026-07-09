import { useMemo } from 'react'
import { Ribbon } from './components/Ribbon/Ribbon'
import { Hierarchy } from './components/Hierarchy/Hierarchy'
import { Viewport } from './components/Viewport/Viewport'
import { Inspector } from './components/Inspector/Inspector'
import { Assets } from './components/Assets/Assets'
import { AIAssistant } from './components/AIAssistant/AIAssistant'
import { ComponentGallery } from './components/ComponentGallery/ComponentGallery'
import { DockLayout } from './components/shared/DockLayout'
import { DockZoneRenderer } from './components/shared/DockZoneRenderer'
import { DockablePanel } from './components/shared/DockablePanel'
import styles from './App.module.css'

function App() {
  // Memoize widgetMap to prevent unnecessary remounts when docking layout changes
  const widgetMap = useMemo(() => ({
    inspector: <Inspector />,
    viewport: (
      <DockablePanel widgetId="viewport" title="Viewport">
        <Viewport />
      </DockablePanel>
    ),
    assets: <Assets />,
    'ai-assistant': <AIAssistant />,
    explorer: <Hierarchy />,
    componentGallery: <ComponentGallery />,
  }), [])

  // Studio is locked to ribbon mode — see dockingStore.studioMode for the
  // enforcement rationale. The Toolbar (shell-mode chrome) is intentionally
  // not rendered here.
  return (
    <div className={styles.editor}>
      <Ribbon />
      <DockLayout
        leftZone={<DockZoneRenderer zone="left" widgetMap={widgetMap} />}
        centerTopZone={<DockZoneRenderer zone="center-top" widgetMap={widgetMap} />}
        centerBottomZone={<DockZoneRenderer zone="center-bottom" widgetMap={widgetMap} />}
        rightTopZone={<DockZoneRenderer zone="right-top" widgetMap={widgetMap} />}
        rightBottomZone={<DockZoneRenderer zone="right-bottom" widgetMap={widgetMap} />}
      />
    </div>
  )
}

export default App




