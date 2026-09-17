'use client'

import { useCallback, useState } from 'react'

/**
 * Callback ref + measured content width, so SVG charts can draw in real pixels
 * (a scaled viewBox would shrink 11px axis labels below the type minimum).
 */
export function useElementWidth<T extends HTMLElement>(initial = 320) {
  const [width, setWidth] = useState(initial)
  const ref = useCallback((node: T | null) => {
    if (!node) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width)
    })
    observer.observe(node)
    setWidth(node.clientWidth)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}
