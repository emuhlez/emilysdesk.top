import { shallow } from 'zustand/shallow'
import { useDockingStore } from '../../store/dockingStore'
import { useWidgetMetadataStore } from '../../store/widgetMetadataStore'
import { TabbedPanel } from './TabbedPanel'
import type { DockZone } from '../../types'
import type { ReactNode } from 'react'

interface DockZoneRendererProps {
  zone: DockZone
  widgetMap: Record<string, ReactNode>
}

export function DockZoneRenderer({ zone, widgetMap }: DockZoneRendererProps) {
  const widgets = useDockingStore((state) => state.getWidgetsInZone(zone), shallow)
  // Subscribe to metadata so we re-render once widgets register themselves.
  const metadata = useWidgetMetadataStore((state) => state.metadata)
  
  if (widgets.length === 0) {
    return null
  }
  
  // If multiple widgets, group them in a tabbed panel
  if (widgets.length > 1) {
    const tabs = widgets
      .map((widget) => {
        const meta = metadata[widget.id]
        if (!meta) return null
        return {
          id: meta.id,
          title: meta.title,
          actions: meta.actions,
        }
      })
      .filter((tab): tab is NonNullable<typeof tab> => tab !== null)
    
    // If we don't have metadata yet, render widgets normally until metadata is available
    if (tabs.length !== widgets.length) {
      return (
        <>
          {widgets.map((widget) => (
            <div key={widget.id} style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
              {widgetMap[widget.id]}
            </div>
          ))}
        </>
      )
    }
    
    const tabContents: Record<string, ReactNode> = {}
    widgets.forEach((widget) => {
      tabContents[widget.id] = widgetMap[widget.id]
    })
    
    const zoneTitle = undefined

    return (
      <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        <TabbedPanel tabs={tabs} tabContents={tabContents} zone={zone} title={zoneTitle} />
      </div>
    )
  }
  
  // Single widget - render normally
  return (
    <div key={widgets[0].id} style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
      {widgetMap[widgets[0].id]}
    </div>
  )
}

