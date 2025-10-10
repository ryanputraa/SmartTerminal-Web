"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Header } from "@/components/aires/header"
import { useHardwareWS } from "@/hooks/use-hardware-ws"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

async function processDocumentCrop(dataUrl: string): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.crossOrigin = "anonymous"
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = dataUrl
    })

    const w = img.naturalWidth
    const h = img.naturalHeight
    if (!w || !h) return null

    // Draw to canvas
    const srcCanvas = document.createElement("canvas")
    srcCanvas.width = w
    srcCanvas.height = h
    const ctx = srcCanvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, w, h)
    const src = ctx.getImageData(0, 0, w, h)
    const d = src.data

    // --- Step 1: adaptive mask for bright area (paper) ---
    const mask = new Uint8Array(w * h)
    const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b

    // Compute global mean luminance
    let sumL = 0
    for (let i = 0; i < d.length; i += 4) sumL += luminance(d[i], d[i + 1], d[i + 2])
    const avgL = sumL / (w * h)

    const WHITE_LUMA = Math.max(140, avgL * 1.1) // adapt to lighting
    const CHROMA_T = 40 // allow small color tint (warmer paper, etc.)

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4
        const r = d[idx],
          g = d[idx + 1],
          b = d[idx + 2]
        const lum = luminance(r, g, b)
        const chroma = Math.max(r, g, b) - Math.min(r, g, b)
        mask[y * w + x] = lum >= WHITE_LUMA && chroma <= CHROMA_T ? 1 : 0
      }
    }

    // --- Step 2: simple blur/close to merge noisy regions ---
    const smooth = new Uint8Array(w * h)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let sum = 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) sum += mask[(y + dy) * w + (x + dx)]
        smooth[y * w + x] = sum >= 4 ? 1 : 0 // majority filter
      }
    }

    // --- Step 3: find largest connected white region ---
    const visited = new Uint8Array(w * h)
    let bestBox = null
    let bestCount = 0

    function floodFill(sx: number, sy: number) {
      const stack = [[sx, sy]]
      let minX = sx,
        maxX = sx,
        minY = sy,
        maxY = sy
      let count = 0
      visited[sy * w + sx] = 1

      while (stack.length) {
        const [x, y] = stack.pop()!
        count++
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx,
              ny = y + dy
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
            const idx = ny * w + nx
            if (!visited[idx] && smooth[idx]) {
              visited[idx] = 1
              stack.push([nx, ny])
            }
          }
        }
      }

      return { minX, minY, maxX, maxY, count }
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x
        if (!smooth[idx] || visited[idx]) continue
        const box = floodFill(x, y)
        if (box.count > bestCount) {
          bestCount = box.count
          bestBox = box
        }
      }
    }

    if (!bestBox || bestCount < w * h * 0.02) {
      console.warn("No significant paper region found; returning original.")
      return dataUrl
    }

    const { minX, minY, maxX, maxY } = bestBox
    const cw = maxX - minX + 1
    const ch = maxY - minY + 1

    // --- Step 4: crop output canvas ---
    const outCanvas = document.createElement("canvas")
    outCanvas.width = cw
    outCanvas.height = ch
    const octx = outCanvas.getContext("2d")
    if (!octx) return null

    octx.drawImage(img, minX, minY, cw, ch, 0, 0, cw, ch)
    return outCanvas.toDataURL("image/jpeg", 0.95)
  } catch (e) {
    console.error("[v1] Scanner crop failed:", e)
    return null
  }
}



export default function ScannerPage() {
  const { connected, statusText, state, sendCmd } = useHardwareWS()
  const lastDownloadedRef = useRef<string | null>(null)
  const [processedImg, setProcessedImg] = useState<string | null>(null)

  // Auto open scanner on mount (when connected) and close on unmount
  useEffect(() => {
    if (connected) {
      sendCmd("highCamera", "open")
    }
    return () => {
      sendCmd("highCamera", "close")
    }
  }, [connected, sendCmd])

  // Auto-download new captures
  useEffect(() => {
    if (!state.photoImg) return
    if (lastDownloadedRef.current === state.photoImg) return
    lastDownloadedRef.current = state.photoImg

    let active = true
    ;(async () => {
      const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19)
      const filename = `scanner-photo-cropped-${ts}.jpg`

      const processed = await processDocumentCrop(state.photoImg!)
      const out = processed || state.photoImg!
      if (!active) return

      setProcessedImg(out)
      downloadDataUrl(out, filename)
    })()

    return () => {
      active = false
    }
  }, [state.photoImg])

  return (
    <main className="min-h-dvh">
      <Header status={statusText as "Connected" | "Disconnected"} />
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4">
          <Button asChild variant="secondary">
            <Link href="/">← Back to Home</Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-xl">High‑Speed Camera (Scanner)</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => sendCmd("highCamera", "open")} disabled={!connected}>
                Open
              </Button>
              <Button variant="secondary" onClick={() => sendCmd("highCamera", "takePhoto")} disabled={!connected}>
                Take Photo
              </Button>
              <Button variant="destructive" onClick={() => sendCmd("highCamera", "close")} disabled={!connected}>
                Close
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px]">
              <div className="rounded-md border border-border bg-black">
                <img
                  src={state.highPreview || "/placeholder.svg?height=420&width=720&query=high-speed-preview"}
                  alt="Scanner live preview"
                  className="h-[420px] w-full rounded-md object-contain"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-sm font-medium text-muted-foreground">Last captured (cropped)</div>
                <div className="rounded-md border border-border bg-black p-2">
                  <img
                    src={
                      processedImg ||
                      state.photoImg ||
                      "/placeholder.svg?height=200&width=200&query=last-captured-photo" ||
                      "/placeholder.svg" ||
                      "/placeholder.svg"
                    }
                    alt="Last captured cropped document"
                    className="h-[200px] w-[200px] rounded object-contain"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  New photos are automatically cropped to the document and downloaded.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
