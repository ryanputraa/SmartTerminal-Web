"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import { Header } from "@/components/aires/header"
import { useHardwareWS } from "@/hooks/use-hardware-ws"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
type Mat = any;


//
// ---------- Utility Helpers ----------
//
const downloadDataUrl = (dataUrl: string, filename: string) => {
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = filename
  a.click()
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

//
// ---------- OpenCV Loader ----------
//
function useOpenCV() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const w = window as any
    if (w.cv?.Mat) return setReady(true)

    if (!w.__opencvPromise) {
      w.__opencvPromise = new Promise<void>((resolve, reject) => {
        const script = document.createElement("script")
        script.src = "https://docs.opencv.org/4.x/opencv.js"
        script.async = true
        script.onload = () => {
          const wait = () => (w.cv?.Mat ? resolve() : setTimeout(wait, 50))
          wait()
        }
        script.onerror = reject
        document.body.appendChild(script)
      })
    }

    w.__opencvPromise
      .then(() => {
        console.log("✅ OpenCV.js ready")
        setReady(true)
      })
      .catch((err: any) => console.error("❌ OpenCV load failed", err))
  }, [])

  return ready
}

//
// ---------- Document Processing Core ----------
//
async function processDocumentCrop(dataUrl: string): Promise<string | null> {
  // --- Wait for OpenCV to be ready ---
  if (typeof cv === "undefined") {
    await new Promise((resolve) => {
      const check = () =>
        typeof cv !== "undefined" ? resolve(true) : setTimeout(check, 50)
      check()
    })
  }

  // --- Utility: load image from data URL ---
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

    // --- Scale down image for contour detection ---
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

    const mask = new cv.Mat()
    cv.threshold(gray, mask, 5, 255, cv.THRESH_BINARY)

    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5))
    cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel)
    cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel)

    // --- Contour detection ---
    const contours = new cv.MatVector()
    const hierarchy = new cv.Mat()
    cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
    cv.medianBlur(mask, mask, 5)

    // --- Find largest 4-corner contour ---
    let bestCnt: Mat | null = null
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
          if (bestCnt) bestCnt.delete()
          bestCnt = approx
        } else {
          approx.delete()
        }
      } else {
        approx.delete()
      }
    }

    // --- Perspective warp or fallback ---
    let warped = new cv.Mat()

    if (bestCnt && bestArea > 10000) {
      const pts = []
      for (let i = 0; i < 4; i++) {
        const p = bestCnt.intPtr(i, 0)
        pts.push({ x: p[0], y: p[1] })
      }

      // Scale points back to original resolution
      if (scale < 1) {
        for (const p of pts) {
          p.x /= scale
          p.y /= scale
        }
      }

      // Order roughly clockwise
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

      srcPts.delete()
      dstPts.delete()
      M.delete()
    } else {
      warped = src.clone()
    }

    // --- Edge cleanup (remove border padding) ---
    const grayWarped = new cv.Mat()
    cv.cvtColor(warped, grayWarped, cv.COLOR_RGBA2GRAY)
    const maskWarped = new cv.Mat()
    cv.threshold(grayWarped, maskWarped, 10, 255, cv.THRESH_BINARY)

    const contoursWarped = new cv.MatVector()
    const hierarchyWarped = new cv.Mat()
    cv.findContours(maskWarped, contoursWarped, hierarchyWarped, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    if (contoursWarped.size() > 0) {
      let biggestRect: any = null
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

    contoursWarped.delete()
    hierarchyWarped.delete()
    grayWarped.delete()
    maskWarped.delete()

    // --- Auto-rotate (choose best orientation) ---
    const rotations = [0, 90, 180, 270]
    let bestScore = -Infinity
    let bestRotated: Mat | null = null
    let bestAngle = 0

    for (const angle of rotations) {
      const rotated = new cv.Mat()
      if (angle === 90) cv.rotate(warped, rotated, cv.ROTATE_90_CLOCKWISE)
      else if (angle === 180) cv.rotate(warped, rotated, cv.ROTATE_180)
      else if (angle === 270) cv.rotate(warped, rotated, cv.ROTATE_90_COUNTERCLOCKWISE)
      else warped.copyTo(rotated)

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

      const score = meanX - meanY
      const isPortrait = rotated.rows >= rotated.cols
      const EPS = 2.0

      if (score > bestScore + 1e-6 || (Math.abs(score - bestScore) <= EPS && isPortrait && bestRotated)) {
        if (bestRotated) bestRotated.delete()
        bestRotated = rotated.clone()
        bestScore = score
        bestAngle = angle
      }

      rotated.delete()
      grayR.delete()
      sobelX.delete()
      sobelY.delete()
      absX.delete()
      absY.delete()
    }

    if (!bestRotated) bestRotated = warped.clone()
    warped.delete()
    warped = bestRotated

    const shadowCorrection = (src: Mat): Mat => {
      const hsv = new cv.Mat()
      const dst = new cv.Mat()

      const channels = src.channels()
      console.log("ShadowCorrection: input channels =", channels)

      let codeToHSV, codeToRGB

      // Assign numeric fallback values if constants are missing
      if (channels === 4) {
        codeToHSV = cv.COLOR_RGBA2HSV ?? 41 // Fallback numeric constant
        codeToRGB = cv.COLOR_HSV2RGBA ?? 55
      } else if (channels === 3) {
        codeToHSV = cv.COLOR_BGR2HSV ?? 40
        codeToRGB = cv.COLOR_HSV2BGR ?? 54
      } else {
        console.warn("Unsupported image channels:", channels)
        src.copyTo(dst)
        return dst
      }

      // Convert to HSV
      cv.cvtColor(src, hsv, codeToHSV)

      // Split channels
      const hsvChannels = new cv.MatVector()
      cv.split(hsv, hsvChannels)

      const V = hsvChannels.get(2)
      const floatV = new cv.Mat()
      const background = new cv.Mat()
      const correctedV = new cv.Mat()

      // Convert to float
      V.convertTo(floatV, cv.CV_32F)

      // Blur to approximate illumination
      cv.GaussianBlur(floatV, background, new cv.Size(101, 101), 0)

      // Add constant to avoid divide-by-zero
      const ones = cv.Mat.ones(background.rows, background.cols, background.type())
      cv.add(background, ones, background)

      // Normalize brightness
      cv.divide(floatV, background, floatV)

      // Scale back to 0–255
      cv.normalize(floatV, floatV, 0, 255, cv.NORM_MINMAX)
      floatV.convertTo(correctedV, cv.CV_8U)

      // Replace V and merge
      hsvChannels.set(2, correctedV)
      const merged = new cv.Mat()
      cv.merge(hsvChannels, merged)
      cv.cvtColor(merged, dst, codeToRGB)

      // Cleanup
      hsv.delete()
      hsvChannels.delete()
      V.delete()
      floatV.delete()
      background.delete()
      correctedV.delete()
      merged.delete()
      ones.delete()

      return dst
    }



    warped = shadowCorrection(warped)


    const lightenCurve = (src: Mat): Mat => {
      const dst = new cv.Mat();
      const lut = new Uint8Array(256);

      // Define control points
      const points = [
        { x: 0, y: 0 },
        { x: 82, y: 148 },
        { x: 122, y: 255 },
        { x: 255, y: 255 },
      ];

      // Linear interpolation between points
      let pi = 0;
      for (let i = 0; i < 256; i++) {
        while (pi < points.length - 1 && i > points[pi + 1].x) {
          pi++;
        }

        const p0 = points[pi];
        const p1 = points[Math.min(pi + 1, points.length - 1)];

        const t = (i - p0.x) / (p1.x - p0.x || 1); // avoid div0
        const y = Math.round(p0.y + t * (p1.y - p0.y));
        lut[i] = Math.min(255, Math.max(0, y));
      }

      const lutMat = cv.matFromArray(1, 256, cv.CV_8UC1, Array.from(lut));

      // Apply LUT to all channels
      const channels = new cv.MatVector();
      cv.split(src, channels);
      for (let i = 0; i < channels.size(); i++) {
        const out = new cv.Mat();
        cv.LUT(channels.get(i), lutMat, out);
        channels.set(i, out);
        out.delete();
      }

      cv.merge(channels, dst);
      channels.delete();
      lutMat.delete();

      return dst
    }

    warped = lightenCurve(warped)

    // --- Export result ---
    const canvas = document.createElement("canvas")
    cv.imshow(canvas, warped)

    // --- Cleanup ---
    src.delete()
    resized.delete()
    gray.delete()
    mask.delete()
    kernel.delete()
    contours.delete()
    hierarchy.delete()
    if (bestCnt) bestCnt.delete()
    warped.delete()
    

    return canvas.toDataURL("image/jpeg", 1.0)
  } catch (e) {
    console.error("processDocumentCrop error:", e)
    return null
  }
}


//
// ---------- Main React Component ----------
//
export default function ScannerPage() {
  const cvReady = useOpenCV()
  const { connected, statusText, state, sendCmd } = useHardwareWS()
  const [processedImg, setProcessedImg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const lastRef = useRef<string | null>(null)

  // Load OpenCV
  useEffect(() => {
    if (cvReady) console.log("✅ OpenCV ready.")
  }, [cvReady])

  // Camera open/close
  useEffect(() => {
    if (!connected) return
    sendCmd("highCamera", "open")
    return () => sendCmd("highCamera", "close")
  }, [connected, sendCmd])

  // Auto process new captures
  useEffect(() => {
    const photo = state.photoImg
    if (!photo || lastRef.current === photo) return
    lastRef.current = photo
    ;(window.requestIdleCallback || window.setTimeout)(async () => {
      const out = await processDocumentCrop(photo)
      setProcessedImg(out || photo)
    })
  }, [state.photoImg])

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const result = ev.target?.result as string
      if (!result) return
      const out = await processDocumentCrop(result)
      setProcessedImg(out || result)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleDownload = useCallback(() => {
    if (!processedImg) return
    const ts = new Date().toISOString().replace(/[:.]/g, "-")
    downloadDataUrl(processedImg, `scanner-${ts}.jpg`)
  }, [processedImg])

  return (
    <main className="min-h-dvh">
      <Header status={statusText as "Connected" | "Disconnected"} />
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4">
          <Button asChild variant="secondary">
            <Link href="/">← Back</Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-xl">High-Speed Camera</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => sendCmd("highCamera", "open")} disabled={!connected}>Open</Button>
              <Button variant="secondary" onClick={() => sendCmd("highCamera", "takePhoto")} disabled={!connected}>Take Photo</Button>
              <Button variant="destructive" onClick={() => sendCmd("highCamera", "close")} disabled={!connected}>Close</Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <div className="rounded-md border bg-black">
                <img
                  src={state.highPreview || "/placeholder.svg?height=420&width=720"}
                  alt="Scanner live preview"
                  className="h-[420px] w-full object-contain rounded-md"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-sm text-muted-foreground font-medium">Upload or Last Capture</div>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                <Button variant="outline" onClick={() => fileRef.current?.click()}>Upload</Button>
                <div className="rounded-md border bg-black p-2">
                  <img
                    src={processedImg || state.photoImg || "/placeholder.svg?height=200&width=200"}
                    alt="Processed preview"
                    className="h-[200px] w-[200px] object-contain rounded"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {processedImg && (
          <Card className="mt-6">
            <CardHeader><CardTitle>Processed Result</CardTitle></CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <img src={processedImg} alt="Processed" className="w-full rounded-md border object-contain" />
              <Button onClick={handleDownload}>Download</Button>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  )
}
