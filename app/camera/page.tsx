"use client"

import Link from "next/link"
import { Header } from "@/components/aires/header"
import { useHardwareWS } from "@/hooks/use-hardware-ws"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect } from "react"

// Utility to download the current preview as a photo
function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export default function CameraPage() {
  const { connected, statusText, state, sendCmd } = useHardwareWS()

  useEffect(() => {
    if (connected) {
      sendCmd("camera", "open")
    }
    return () => {
      sendCmd("camera", "close")
    }
  }, [connected, sendCmd])

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
            <CardTitle className="text-xl">Camera</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => sendCmd("camera", "open")} disabled={!connected}>
                Open
              </Button>
              <Button variant="secondary" onClick={() => sendCmd("camera", "faceDetection")} disabled={!connected}>
                Face Detection
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (!state.cameraPreview) return
                  const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19)
                  const filename = `camera-photo-${ts}.jpg`
                  downloadDataUrl(state.cameraPreview, filename)
                }}
                disabled={!connected || !state.cameraPreview}
              >
                Take Photo
              </Button>
              <Button variant="destructive" onClick={() => sendCmd("camera", "close")} disabled={!connected}>
                Close
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px]">
              <div className="rounded-md border border-border bg-black">
                <img
                  src={state.cameraPreview || "/placeholder.svg?height=420&width=720&query=camera-preview"}
                  alt="Camera live preview"
                  className="h-[420px] w-full rounded-md object-contain"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-sm font-medium text-muted-foreground">Face detection</div>
                <div className="rounded-md border border-border bg-black p-2">
                  <img
                    src={state.faceImg || "/placeholder.svg?height=200&width=200&query=face-detection"}
                    alt="Latest face detection result"
                    className="h-[200px] w-[200px] rounded object-contain"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Tip: Click Face Detection after opening to capture the face image.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
