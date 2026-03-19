'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface Props {
  before: string
  after: string
  beforeLabel?: string
  afterLabel?: string
}

export default function BeforeAfterSlider({
  before,
  after,
  beforeLabel = 'Voor',
  afterLabel = 'Na',
}: Props) {
  const [position, setPosition] = useState(50)
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const updatePosition = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left
    const pct = Math.min(100, Math.max(0, (x / rect.width) * 100))
    setPosition(pct)
  }, [])

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    updatePosition(e.clientX)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    setDragging(true)
    updatePosition(e.touches[0].clientX)
  }

  useEffect(() => {
    if (!dragging) return

    const onMouseMove = (e: MouseEvent) => updatePosition(e.clientX)
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      updatePosition(e.touches[0].clientX)
    }
    const onUp = () => setDragging(false)

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onUp)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [dragging, updatePosition])

  // Allow clicking/tapping anywhere on the container to jump the divider
  const onContainerMouseDown = (e: React.MouseEvent) => {
    updatePosition(e.clientX)
    setDragging(true)
  }

  const onContainerTouchStart = (e: React.TouchEvent) => {
    updatePosition(e.touches[0].clientX)
    setDragging(true)
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-2xl select-none cursor-col-resize"
      style={{ minHeight: '300px', maxHeight: '600px' }}
      onMouseDown={onContainerMouseDown}
      onTouchStart={onContainerTouchStart}
    >
      {/* After image (background — always full width) */}
      <img
        src={after}
        alt={afterLabel}
        className="w-full h-full object-contain block"
        style={{ minHeight: '300px', maxHeight: '600px' }}
        draggable={false}
      />

      {/* Before image clipped to the left portion */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        <img
          src={before}
          alt={beforeLabel}
          className="absolute top-0 left-0 h-full object-contain block"
          style={{
            width: containerRef.current
              ? `${containerRef.current.getBoundingClientRect().width}px`
              : '100%',
            maxHeight: '600px',
          }}
          draggable={false}
        />
      </div>

      {/* Divider line + handle */}
      <div
        className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none"
        style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
      >
        {/* Top half of line */}
        <div className="flex-1 w-0.5 bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.6)]" />

        {/* Circular handle */}
        <div
          className="pointer-events-auto w-10 h-10 rounded-full bg-white border-2 border-purple-500 shadow-[0_0_16px_rgba(168,85,247,0.6)] flex items-center justify-center gap-0.5 flex-shrink-0 z-10"
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
        >
          <span className="text-purple-600 font-bold text-sm leading-none select-none">‹</span>
          <span className="text-purple-600 font-bold text-sm leading-none select-none">›</span>
        </div>

        {/* Bottom half of line */}
        <div className="flex-1 w-0.5 bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
      </div>

      {/* Corner labels */}
      <div className="absolute top-3 left-3 pointer-events-none">
        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-black/40 backdrop-blur-md border border-white/10">
          {beforeLabel}
        </span>
      </div>
      <div className="absolute top-3 right-3 pointer-events-none">
        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-black/40 backdrop-blur-md border border-white/10">
          {afterLabel}
        </span>
      </div>
    </div>
  )
}
