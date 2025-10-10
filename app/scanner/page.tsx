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
    // --- Load image ---
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.crossOrigin = "anonymous"
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = dataUrl
    })

    // --- Rotate left (90° counterclockwise) ---
    const rotatedCanvas = document.createElement("canvas")
    rotatedCanvas.width = img.naturalHeight
    rotatedCanvas.height = img.naturalWidth
    const rctx = rotatedCanvas.getContext("2d")!
    // move origin to bottom-left, rotate CCW
    rctx.translate(0, rotatedCanvas.height)
    rctx.rotate(-Math.PI / 2)
    rctx.drawImage(img, 0, 0)

    // from here on, treat the rotated image as the base
    const w = rotatedCanvas.width
    const h = rotatedCanvas.height

    // --- Downscale for document boundary detection ---
    const scale = Math.max(w, h) > 2000 ? 0.25 : 1
    const smallW = Math.floor(w * scale)
    const smallH = Math.floor(h * scale)
    const sCanvas = document.createElement("canvas")
    sCanvas.width = smallW
    sCanvas.height = smallH
    const sctx = sCanvas.getContext("2d", { willReadFrequently: true })!
    sctx.drawImage(rotatedCanvas, 0, 0, smallW, smallH)
    const { data } = sctx.getImageData(0, 0, smallW, smallH)

    // --- Find bounds of non-black area ---
    const blackThreshold = 25
    let minX = smallW, minY = smallH, maxX = 0, maxY = 0
    for (let y = 0; y < smallH; y++) {
      const row = y * smallW * 4
      for (let x = 0; x < smallW; x++) {
        const i = row + x * 4
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3
        if (brightness > blackThreshold) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }

    if (maxX <= minX || maxY <= minY) return rotatedCanvas.toDataURL("image/jpeg", 0.95)

    // --- Map bounds to full res ---
    const invScale = 1 / scale
    const margin = Math.floor(Math.min(w, h) * 0.02)
    const fx1 = Math.max(0, Math.floor(minX * invScale) - margin)
    const fy1 = Math.max(0, Math.floor(minY * invScale) - margin)
    const fx2 = Math.min(w - 1, Math.ceil(maxX * invScale) + margin)
    const fy2 = Math.min(h - 1, Math.ceil(maxY * invScale) + margin)
    const cropW = fx2 - fx1
    const cropH = fy2 - fy1

    // --- Crop ---
    const cCanvas = document.createElement("canvas")
    cCanvas.width = cropW
    cCanvas.height = cropH
    const cctx = cCanvas.getContext("2d", { willReadFrequently: true })!
    cctx.drawImage(rotatedCanvas, fx1, fy1, cropW, cropH, 0, 0, cropW, cropH)

    // --- Get pixels ---
    const imgData = cctx.getImageData(0, 0, cropW, cropH)
    const pixels = imgData.data

    // --- Step 1: Shadow compensation (left/right) ---
    const mid = Math.floor(cropW / 2)
    let leftSum = 0, rightSum = 0, leftCount = 0, rightCount = 0

    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const i = (y * cropW + x) * 4
        const lum = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]
        if (x < mid) {
          leftSum += lum
          leftCount++
        } else {
          rightSum += lum
          rightCount++
        }
      }
    }

    const leftAvg = leftSum / leftCount
    const rightAvg = rightSum / rightCount
    const targetAvg = (leftAvg + rightAvg) / 2

    const leftGain = leftAvg < rightAvg ? targetAvg / leftAvg : 1
    const rightGain = rightAvg < leftAvg ? targetAvg / rightAvg : 1

    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const i = (y * cropW + x) * 4
        const gain = x < mid ? leftGain : rightGain
        pixels[i]     = Math.min(255, pixels[i] * gain)
        pixels[i + 1] = Math.min(255, pixels[i + 1] * gain)
        pixels[i + 2] = Math.min(255, pixels[i + 2] * gain)
      }
    }

    // --- Step 2: Additive enhancement ---
    const threshold_high = 20
    const threshold_low = 10
    const boost = 80
    const cap = 220
    const darkenFactor = 0.5

    for (let i = 0; i < pixels.length; i += 4) {
      const lum = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]

      if (lum > threshold_high) {
        const strength = (lum - threshold_high) / (255 - threshold_high)
        const add = boost * strength
        pixels[i]     = Math.min(cap, pixels[i] + add)
        pixels[i + 1] = Math.min(cap, pixels[i + 1] + add)
        pixels[i + 2] = Math.min(cap, pixels[i + 2] + add)
      } else if (lum < threshold_low) {
        pixels[i]     = pixels[i] * darkenFactor
        pixels[i + 1] = pixels[i + 1] * darkenFactor
        pixels[i + 2] = pixels[i + 2] * darkenFactor
      }
    }

    // --- Output ---
    cctx.putImageData(imgData, 0, 0)
    return cCanvas.toDataURL("image/jpeg", 0.95)
  } catch (err) {
    console.error("Document crop/enhance failed:", err)
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
