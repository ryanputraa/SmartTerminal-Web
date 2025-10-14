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

function useOpenCV() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Skip if already loaded
    if (typeof window !== "undefined" && (window as any).cv) {
      setReady(true)
      return
    }

    const script = document.createElement("script")
    script.src = "https://docs.opencv.org/4.x/opencv.js"
    script.async = true
    script.onload = () => {
      const check = () => {
        if ((window as any).cv && (window as any).cv.Mat) {
          setReady(true)
        } else {
          setTimeout(check, 100)
        }
      }
      check()
    }
    document.body.appendChild(script)
  }, [])

  return ready
}

async function processDocumentCrop(dataUrl: string): Promise<string | null> {
  // Wait for OpenCV to be ready
  if (typeof cv === "undefined") {
    await new Promise((resolve) => {
      const check = () => (typeof cv !== "undefined" ? resolve(true) : setTimeout(check, 50))
      check()
    })
  }

  // Utility: load image into HTMLImageElement
  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }

  try {
    const img = await loadImage(dataUrl)
    const src = cv.imread(img)

    // Resize if huge
    const maxDim = 1600
    const scale = Math.min(1, maxDim / Math.max(src.cols, src.rows))
    const resized = new cv.Mat()
    cv.resize(src, resized, new cv.Size(0, 0), scale, scale, cv.INTER_AREA)

    // --- Edge detection ---
    const gray = new cv.Mat()
    cv.cvtColor(resized, gray, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0)
    const edges = new cv.Mat()
    cv.Canny(gray, edges, 50, 150)

    // --- Find contours ---
    const contours = new cv.MatVector()
    const hierarchy = new cv.Mat()
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    // Pick the biggest 4-corner contour
    let bestCnt = null
    let bestArea = 0
    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i)
      const peri = cv.arcLength(cnt, true)
      const approx = new cv.Mat()
      cv.approxPolyDP(cnt, approx, 0.02 * peri, true)
      if (approx.rows === 4) {
        const area = cv.contourArea(approx)
        if (area > bestArea) {
          bestArea = area
          bestCnt = approx
        } else {
          approx.delete()
        }
      } else {
        approx.delete()
      }
    }

    let warped = new cv.Mat()
    if (bestCnt && bestArea > 10000) {
      // --- Perspective warp ---
      // Order points (top-left, top-right, bottom-right, bottom-left)
      const pts = []
      for (let i = 0; i < 4; i++) {
        const p = bestCnt.intPtr(i, 0)
        pts.push({ x: p[0], y: p[1] })
      }
      // Sort roughly clockwise
      pts.sort((a, b) => a.y - b.y)
      const top = pts.slice(0, 2).sort((a, b) => a.x - b.x)
      const bottom = pts.slice(2).sort((a, b) => a.x - b.x)
      const ordered = [top[0], top[1], bottom[1], bottom[0]]

      const w1 = Math.hypot(ordered[1].x - ordered[0].x, ordered[1].y - ordered[0].y)
      const w2 = Math.hypot(ordered[2].x - ordered[3].x, ordered[2].y - ordered[3].y)
      const h1 = Math.hypot(ordered[3].x - ordered[0].x, ordered[3].y - ordered[0].y)
      const h2 = Math.hypot(ordered[2].x - ordered[1].x, ordered[2].y - ordered[1].y)
      const W = Math.max(w1, w2)
      const H = Math.max(h1, h2)

      const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        ordered[0].x, ordered[0].y,
        ordered[1].x, ordered[1].y,
        ordered[2].x, ordered[2].y,
        ordered[3].x, ordered[3].y,
      ])
      const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, W, 0, W, H, 0, H])
      const M = cv.getPerspectiveTransform(srcPts, dstPts)
      cv.warpPerspective(resized, warped, M, new cv.Size(W, H))
      srcPts.delete(); dstPts.delete(); M.delete()
    } else {
      warped = resized.clone() // fallback: no contour
    }

    // --- Color correction ---
    // Convert to float for math
    const floatImg = new cv.Mat()
    warped.convertTo(floatImg, cv.CV_32F)
    const mean = new cv.Mat()
    const stddev = new cv.Mat()
    cv.meanStdDev(floatImg, mean, stddev)
    const meanVals = mean.data64F
    const ref = (meanVals[0] + meanVals[1] + meanVals[2]) / 3
    const scaleB = ref / meanVals[0]
    const scaleG = ref / meanVals[1]
    const scaleR = ref / meanVals[2]

    const channels = new cv.MatVector()
    cv.split(warped, channels)
    channels.get(0).convertTo(channels.get(0), -1, scaleB, 0)
    channels.get(1).convertTo(channels.get(1), -1, scaleG, 0)
    channels.get(2).convertTo(channels.get(2), -1, scaleR, 0)
    cv.merge(channels, warped)
    channels.delete(); mean.delete(); stddev.delete()

    // --- Mild contrast and sharpen ---
    cv.convertScaleAbs(warped, warped, 1.1, -15)
    const kernel = cv.matFromArray(3, 3, cv.CV_32F, [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0,
    ])
    cv.filter2D(warped, warped, -1, kernel)
    kernel.delete()
    
        // --- Auto-rotate upright ---
    const rotations = [0, 90, 180, 270]
    let bestScore = -Infinity
    let bestRotated: any = null
    let bestAngle = 0

    for (const angle of rotations) {
      const rotated = new cv.Mat()
      if (angle === 90) cv.rotate(warped, rotated, cv.ROTATE_90_CLOCKWISE)
      else if (angle === 180) cv.rotate(warped, rotated, cv.ROTATE_180)
      else if (angle === 270) cv.rotate(warped, rotated, cv.ROTATE_90_COUNTERCLOCKWISE)
      else warped.copyTo(rotated)

      // compute score: horizontal edge energy minus vertical edge energy
      const grayR = new cv.Mat()
      cv.cvtColor(rotated, grayR, cv.COLOR_RGBA2GRAY)
      cv.GaussianBlur(grayR, grayR, new cv.Size(3, 3), 0)

      const sobelX = new cv.Mat()
      const sobelY = new cv.Mat()
      cv.Sobel(grayR, sobelX, cv.CV_32F, 1, 0, 3)
      cv.Sobel(grayR, sobelY, cv.CV_32F, 0, 1, 3)

      const absX = new cv.Mat()
      const absY = new cv.Mat()
      cv.convertScaleAbs(sobelX, absX)
      cv.convertScaleAbs(sobelY, absY)
      const meanX = cv.mean(absX)[0]
      const meanY = cv.mean(absY)[0]

      // score and portrait preference tie-break
      const score = meanX - meanY
      const isPortrait = rotated.rows >= rotated.cols

      // choose if strictly better, or nearly equal but portrait preferred
      const EPS = 2.0 // small tolerance; tuneable
      if (score > bestScore + 1e-6 || (Math.abs(score - bestScore) <= EPS && isPortrait && bestRotated)) {
        // free previous bestRotated
        if (bestRotated) bestRotated.delete()
        bestRotated = rotated.clone()
        bestScore = score
        bestAngle = angle
      }

      // cleanup mats created for this iteration (but keep `rotated` clone only if chosen)
      rotated.delete()
      grayR.delete()
      sobelX.delete(); sobelY.delete()
      absX.delete(); absY.delete()
    }

    // If nothing chosen (shouldn't happen), fallback to original warped
    if (!bestRotated) {
      bestRotated = warped.clone()
    }

    // replace warped with the chosen orientation
    warped.delete()
    warped = bestRotated

    // --- Export ---
    const canvas = document.createElement("canvas")
    cv.imshow(canvas, warped)

    // cleanup
    src.delete(); resized.delete(); gray.delete(); edges.delete()
    contours.delete(); hierarchy.delete()
    if (bestCnt) bestCnt.delete()
    warped.delete(); floatImg.delete()

    return canvas.toDataURL("image/jpeg", 0.9)
  } catch (e) {
    console.error("processDocumentCrop error:", e)
    return null
  }
}



export default function ScannerPage() {
  const cvReady = useOpenCV()
  const { connected, statusText, state, sendCmd } = useHardwareWS()
  const [processedImg, setProcessedImg] = useState<string | null>(null)
  const lastDownloadedRef = useRef<string | null>(null)

  // Wait until OpenCV is ready before scanning
  useEffect(() => {
    if (!cvReady) return
    console.log("✅ OpenCV.js loaded and ready!")
  }, [cvReady])

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
