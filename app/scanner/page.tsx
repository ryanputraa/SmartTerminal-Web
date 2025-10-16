"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Header } from "@/components/aires/header"
import { useHardwareWS } from "@/hooks/use-hardware-ws"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { waitForDebugger } from "inspector"



function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function useOpenCV() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // already loaded case
    if (typeof window !== "undefined" && (window as any).cv && (window as any).cv.Mat) {
      setReady(true);
      return;
    }

    // Use a single global loader promise (to prevent double load in dev)
    if (!(window as any).__opencvPromise) {
      (window as any).__opencvPromise = new Promise<void>((resolve, reject) => {
        const existing = document.querySelector('script[src*="opencv.js"]');
        if (existing) {
          // If script already added, just wait for cv to exist
          const check = () => {
            if ((window as any).cv && (window as any).cv.Mat) resolve();
            else setTimeout(check, 50);
          };
          check();
          return;
        }

        const script = document.createElement("script");
        script.src = "https://docs.opencv.org/4.x/opencv.js";
        script.async = true;
        script.onload = () => {
          const check = () => {
            if ((window as any).cv && (window as any).cv.Mat) resolve();
            else setTimeout(check, 50);
          };
          check();
        };
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }

    // Wait for OpenCV to be ready
    (window as any).__opencvPromise
      .then(() => {
        console.log("✅ OpenCV.js loaded");
        setReady(true);
      })
      .catch((err: any) => {
        console.error("❌ Failed to load OpenCV.js", err);
      });
  }, []);

  return ready;
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

    // Prepare scaled-down copy for contour detection
    const maxDim = 1600
    const scale = Math.min(1, maxDim / Math.max(src.cols, src.rows))
    const resized = new cv.Mat()
    if (scale < 1) {
      cv.resize(src, resized, new cv.Size(0, 0), scale, scale, cv.INTER_AREA)
    } else {
      src.copyTo(resized)
    }


    // --- Non-black mask detection ---
    const gray = new cv.Mat()
    cv.cvtColor(resized, gray, cv.COLOR_RGBA2GRAY)

    // Create a mask of pixels that are NOT black (0–5 range)
    const mask = new cv.Mat()
    cv.threshold(gray, mask, 5, 255, cv.THRESH_BINARY)

    // Optional: smooth edges & fill small holes
    const kernel_2 = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5))
    cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel_2)
    cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel_2)

    // --- Find contours ---
    const contours = new cv.MatVector()
    const hierarchy = new cv.Mat()
    cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    cv.medianBlur(mask, mask, 5)

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
     // Scale points back to original resolution
      if (scale < 1) {
        for (const p of pts) {
          p.x = p.x / scale
          p.y = p.y / scale
        }
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
      cv.warpPerspective(src, warped, M, new cv.Size(W, H))
      srcPts.delete(); dstPts.delete(); M.delete()
    } else {
      warped = src.clone() // fallback: no contour
    }

    // --- Edge cleanup / overcrop ---
    const grayWarped = new cv.Mat()
    cv.cvtColor(warped, grayWarped, cv.COLOR_RGBA2GRAY)

    // threshold to detect non-black area (the real document content)
    const maskWarped = new cv.Mat()
    cv.threshold(grayWarped, maskWarped, 10, 255, cv.THRESH_BINARY)

    // --- Find bounding box of non-black area (findNonZero replacement) ---
    const contoursWarped = new cv.MatVector()
    const hierarchyWarped = new cv.Mat()
    cv.findContours(maskWarped, contoursWarped, hierarchyWarped, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    if (contoursWarped.size() > 0) {
      let biggestRect = null
      let biggestArea = 0
      for (let i = 0; i < contoursWarped.size(); i++) {
        const rect = cv.boundingRect(contoursWarped.get(i))
        const area = rect.width * rect.height
        if (area > biggestArea) {
          biggestArea = area
          biggestRect = rect
        }
      }

      if (biggestRect && biggestArea > 10000) {
        // Apply a small inward crop margin (1–2%)
        const marginX = Math.floor(biggestRect.width * 0.02)
        const marginY = Math.floor(biggestRect.height * 0.02)
        const x = Math.min(Math.max(biggestRect.x + marginX, 0), warped.cols - 1)
        const y = Math.min(Math.max(biggestRect.y + marginY, 0), warped.rows - 1)
        const w = Math.max(biggestRect.width - marginX * 2, 1)
        const h = Math.max(biggestRect.height - marginY * 2, 1)

        const cropped = warped.roi(new cv.Rect(x, y, w, h))
        warped.delete()
        warped = cropped.clone()
        cropped.delete()
      }
    }

    contoursWarped.delete(); hierarchyWarped.delete()
    grayWarped.delete(); maskWarped.delete()

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

    // --- Shadow gradient correction ---
    const illumGray = new cv.Mat()
    cv.cvtColor(warped, illumGray, cv.COLOR_RGBA2GRAY)

    // Estimate background lighting (large blur)
    const background = new cv.Mat()
    const ksize = new cv.Size(101, 101) // big enough to smooth shadows, but not text
    cv.GaussianBlur(illumGray, background, ksize, 0)

    // Convert to float to do per-pixel division
    const floatWarped = new cv.Mat()
    const floatBg = new cv.Mat()
    illumGray.convertTo(floatWarped, cv.CV_32F)
    background.convertTo(floatBg, cv.CV_32F)

    // Prevent divide-by-zero by adding a small constant to the illumination map
    cv.add(floatBg, new cv.Mat(floatBg.rows, floatBg.cols, floatBg.type(), new cv.Scalar(1, 1, 1, 1)), floatBg)


    // Divide original by illumination map (normalize lighting)
    cv.divide(floatWarped, floatBg, floatWarped)


    // Normalize to 0–255 range
    cv.normalize(floatWarped, floatWarped, 0, 255, cv.NORM_MINMAX)

    // Convert back to 8-bit
    const correctedGray = new cv.Mat()
    floatWarped.convertTo(correctedGray, cv.CV_8U)

    // Use the illumination-corrected grayscale as a guide to fix color channels
    const correctedColor = new cv.Mat()
    const channels = new cv.MatVector()
    cv.split(warped, channels)
    for (let i = 0; i < 3; i++) {
      const chan = new cv.Mat()
      channels.get(i).convertTo(chan, cv.CV_32F)
      cv.divide(chan, floatBg, chan)
      cv.normalize(chan, chan, 0, 255, cv.NORM_MINMAX)
      chan.convertTo(chan, cv.CV_8U)
      channels.set(i, chan)
      chan.delete()
    }
    cv.merge(channels, correctedColor)
    warped.delete()
    warped = correctedColor.clone()


    // --- Apply Photoshop-style lighten curve ---
    const lightenCurve = (src: cv.Mat): cv.Mat => {
      const dst = new cv.Mat()
      const floatSrc = new cv.Mat()
      src.convertTo(floatSrc, cv.CV_32F, 1.0 / 255.0)

      // Apply a soft lighten curve:
      //  - keep shadows mostly unchanged (<0.3)
      //  - brighten highlights progressively
      const lut = new cv.Mat(1, 256, cv.CV_8UC1)
      for (let i = 0; i < 256; i++) {
        const x = i / 255.0
        // Smooth "S-curve" style lighten adjustment
        const y = x < 0.3 ? x : 1.0 - Math.pow(1.0 - x, 1.5)
        lut.ucharPtr(0, i)[0] = Math.min(255, Math.max(0, Math.round(y * 255)))
      }

      cv.LUT(src, lut, dst)

      floatSrc.delete()
      lut.delete()
      return dst
    }

    // Apply the curve to the result
    warped = lightenCurve(warped)

    // Cleanup
    illumGray.delete(); background.delete()
    floatWarped.delete(); floatBg.delete()
    correctedGray.delete(); correctedColor.delete()
    channels.delete()
    

    // --- Export ---
    const canvas = document.createElement("canvas")
    cv.imshow(canvas, warped)

    // cleanup
    src.delete(); resized.delete(); gray.delete(); mask.delete(); kernel_2.delete();
    contours.delete(); hierarchy.delete()
    if (bestCnt) bestCnt.delete()
    warped.delete();
  


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
  const [previewVisible, setPreviewVisible] = useState(false)
  const lastDownloadedRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!cvReady) return
    console.log("✅ OpenCV.js loaded and ready!")
  }, [cvReady])

  useEffect(() => {
    if (connected) sendCmd("highCamera", "open")
    return () => sendCmd("highCamera", "close")
  }, [connected, sendCmd])

  // When new photo is captured from the scanner
  useEffect(() => {
    if (!state.photoImg) return
    if (lastDownloadedRef.current === state.photoImg) return
    lastDownloadedRef.current = state.photoImg

    let active = true
    ;(async () => {
      const processed = await processDocumentCrop(state.photoImg!)
      if (!active) return
      setProcessedImg(processed || state.photoImg!)
      setPreviewVisible(true)
    })()

    return () => {
      active = false
    }
  }, [state.photoImg])

const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return

  const reader = new FileReader()

  reader.onload = (ev) => {
    const result = ev.target?.result as string
    if (!result) return

    // Wrap in async IIFE so React event loop handles it properly
    ;(async () => {
      console.log("📤 Upload started, running processDocumentCrop...")
      try {
        const processed = await processDocumentCrop(result)
        console.log("✅ Processing done")
        setProcessedImg(processed || result)
        setPreviewVisible(true)
      } catch (err) {
        console.error("❌ Error processing uploaded image:", err)
        setProcessedImg(result) // fallback
        setPreviewVisible(true)
      }
    })()
  }

  reader.readAsDataURL(file)
}


  // Download manually
  const handleDownload = () => {
    if (!processedImg) return
    const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19)
    downloadDataUrl(processedImg, `scanner-photo-cropped-${ts}.jpg`)
  }

  return (
    <main className="min-h-dvh">
      <Header status={statusText as "Connected" | "Disconnected"} />
      <section className="mx-auto max-w-6xl px-4 py-6">
        {/* Back Button */}
        <div className="mb-4">
          <Button asChild variant="secondary">
            <Link href="/">← Back to Home</Link>
          </Button>
        </div>

        {/* Scanner Controls */}
        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-xl">High-Speed Camera (Scanner)</CardTitle>
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
              {/* Live Preview */}
              <div className="rounded-md border border-border bg-black">
                <img
                  src={state.highPreview || "/placeholder.svg?height=420&width=720&query=high-speed-preview"}
                  alt="Scanner live preview"
                  className="h-[420px] w-full rounded-md object-contain"
                />
              </div>

              {/* Side Column */}
              <div className="flex flex-col gap-2">
                <div className="text-sm font-medium text-muted-foreground">Upload or Last Captured</div>

                {/* Upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  Upload Image
                </Button>

                {/* Thumbnail */}
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
                  New photos or uploads are processed and shown below for preview.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Final Preview Section */}
        {previewVisible && processedImg && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Final Processed Result</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <img
                src={processedImg}
                alt="Final processed document"
                className="w-full max-w-[100%] h-auto rounded-md border border-border object-contain"
              />
              <Button onClick={handleDownload} variant="default">
                Download Cropped Result
              </Button>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  )
}
