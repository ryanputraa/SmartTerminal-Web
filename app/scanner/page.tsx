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
    const srcData = sctx.getImageData(0, 0, w, h)
    const d = srcData.data

    // Estimate background by averaging pixels in the corners
    const sampleCorner = (x0: number, y0: number, xs: number, ys: number) => {
      const box = Math.max(8, Math.floor(Math.min(w, h) * 0.02))
      let r = 0,
        g = 0,
        b = 0,
        n = 0
      for (let y = y0; y < y0 + box && y < h; y++) {
        for (let x = x0; x < x0 + box && x < w; x++) {
          const idx = (y * w + x) * 4
          r += d[idx]
          g += d[idx + 1]
          b += d[idx + 2]
          n++
        }
      }
      return [r / n, g / n, b / n] as [number, number, number]
    }

    const c1 = sampleCorner(0, 0, 1, 1)
    const c2 = sampleCorner(w - 10, 0, -1, 1)
    const c3 = sampleCorner(0, h - 10, 1, -1)
    const c4 = sampleCorner(w - 10, h - 10, -1, -1)
    const bg: [number, number, number] = [
      (c1[0] + c2[0] + c3[0] + c4[0]) / 4,
      (c1[1] + c2[1] + c3[1] + c4[1]) / 4,
      (c1[2] + c2[2] + c3[2] + c4[2]) / 4,
    ]

    const bgLum = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]
    const colorDist = (r: number, g: number, b: number) =>
      Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2])
    const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b

    // Thresholds tuned for common desk/document scenarios; adjust if needed
    const DIST_T = 45
    const LUM_T = 20

    // Build mask and bounding box
    let minX = w,
      minY = h,
      maxX = -1,
      maxY = -1
    const mask = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4
        const r = d[idx],
          g = d[idx + 1],
          b = d[idx + 2]
        const lum = luminance(r, g, b)
        const isFg = colorDist(r, g, b) > DIST_T || Math.abs(lum - bgLum) > LUM_T
        if (isFg) {
          mask[y * w + x] = 1
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }

    if (maxX < 0 || maxY < 0) {
      // Fallback if nothing detected
      return dataUrl
    }

    // Inflate bbox slightly
    const MARGIN = Math.floor(Math.min(w, h) * 0.01) + 8
    minX = Math.max(0, minX - MARGIN)
    minY = Math.max(0, minY - MARGIN)
    maxX = Math.min(w - 1, maxX + MARGIN)
    maxY = Math.min(h - 1, maxY + MARGIN)
    const cw = maxX - minX + 1
    const ch = maxY - minY + 1

    // Compose output: black background, copy only foreground pixels
    const outCanvas = document.createElement("canvas")
    outCanvas.width = cw
    outCanvas.height = ch
    const octx = outCanvas.getContext("2d")
    if (!octx) return null

    const outImage = octx.createImageData(cw, ch)
    const out = outImage.data

    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const sx = minX + x
        const sy = minY + y
        const sIdx = (sy * w + sx) * 4
        const oIdx = (y * cw + x) * 4
        if (mask[sy * w + sx]) {
          out[oIdx] = d[sIdx]
          out[oIdx + 1] = d[sIdx + 1]
          out[oIdx + 2] = d[sIdx + 2]
          out[oIdx + 3] = 255
        } else {
          // pitch black background
          out[oIdx] = 0
          out[oIdx + 1] = 0
          out[oIdx + 2] = 0
          out[oIdx + 3] = 255
        }
      }
    }

    octx.putImageData(outImage, 0, 0)
    // Export as high-quality JPEG; change to "image/png" if you prefer lossless
    const processedUrl = outCanvas.toDataURL("image/jpeg", 0.95)
    return processedUrl
  } catch (e) {
    console.error("[v0] Scanner crop failed:", e)
    return null
  }
}

export default function ScannerPage() {
  const { connected, statusText, state, sendCmd } = useHardwareWS()
  const lastDownloadedRef = useRef<string | null>(null)
  const [processedImg, setProcessedImg] = useState<string | null>(null) // hold processed preview

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
                      "/placeholder.svg?height=200&width=200&query=last-captured-photo"
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
