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

    const srcCanvas = document.createElement("canvas")
    srcCanvas.width = w
    srcCanvas.height = h
    const sctx = srcCanvas.getContext("2d", { willReadFrequently: true })
    if (!sctx) return null
    sctx.drawImage(img, 0, 0, w, h)
    const src = sctx.getImageData(0, 0, w, h)
    const d = src.data

    // White-paper mask: high luminance, low chroma (R,G,B close together)
    const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b
    const WHITE_LUMA = 200 // higher -> stricter white
    const CHROMA_T = 25 // lower -> stricter gray/white

    const mask = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4
        const r = d[idx],
          g = d[idx + 1],
          b = d[idx + 2]
        const lum = luminance(r, g, b)
        const maxC = Math.max(r, g, b),
          minC = Math.min(r, g, b)
        const chroma = maxC - minC
        mask[y * w + x] = lum >= WHITE_LUMA && chroma <= CHROMA_T ? 1 : 0
      }
    }

    // Optional: small morphological close to fill tiny gaps without adding margin
    const closed = new Uint8Array(w * h)
    const kernel = [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [0, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ]
    // Dilate
    const dil = new Uint8Array(w * h)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let on = 0
        for (const [dx, dy] of kernel) {
          if (mask[(y + dy) * w + (x + dx)]) {
            on = 1
            break
          }
        }
        dil[y * w + x] = on
      }
    }
    // Erode
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let all = 1
        for (const [dx, dy] of kernel) {
          if (!dil[(y + dy) * w + (x + dx)]) {
            all = 0
            break
          }
        }
        closed[y * w + x] = all
      }
    }

    // Tight bounding box (no margin)
    let minX = w,
      minY = h,
      maxX = -1,
      maxY = -1
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (closed[y * w + x]) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }

    if (maxX < 0 || maxY < 0) {
      // Fallback if no paper detected: return original
      return dataUrl
    }

    const cw = maxX - minX + 1
    const ch = maxY - minY + 1

    // Compose output: white background; copy only white-paper pixels
    const outCanvas = document.createElement("canvas")
    outCanvas.width = cw
    outCanvas.height = ch
    const octx = outCanvas.getContext("2d")
    if (!octx) return null

    // White background (no black borders)
    octx.fillStyle = "#ffffff"
    octx.fillRect(0, 0, cw, ch)

    const out = octx.createImageData(cw, ch)
    const od = out.data
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const sx = minX + x
        const sy = minY + y
        const sIdx = (sy * w + sx) * 4
        const oIdx = (y * cw + x) * 4
        if (closed[sy * w + sx]) {
          od[oIdx] = d[sIdx]
          od[oIdx + 1] = d[sIdx + 1]
          od[oIdx + 2] = d[sIdx + 2]
          od[oIdx + 3] = 255
        } else {
          // paint white where not paper (ensures no background bleed)
          od[oIdx] = 255
          od[oIdx + 1] = 255
          od[oIdx + 2] = 255
          od[oIdx + 3] = 255
        }
      }
    }
    octx.putImageData(out, 0, 0)

    // Export high-quality JPEG; this "stretches" (scales) to the tight crop size automatically
    return outCanvas.toDataURL("image/jpeg", 0.95)
  } catch (e) {
    console.error("[v0] Scanner crop failed:", e)
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
