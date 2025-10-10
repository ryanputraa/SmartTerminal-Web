"use client"

import { useEffect, useRef } from "react"
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

export default function ScannerPage() {
  const { connected, statusText, state, sendCmd } = useHardwareWS()
  const lastDownloadedRef = useRef<string | null>(null)

  // Auto-download new captures
  useEffect(() => {
    if (!state.photoImg) return
    if (lastDownloadedRef.current === state.photoImg) return
    lastDownloadedRef.current = state.photoImg
    const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19)
    const filename = `scanner-photo-${ts}.jpg`
    downloadDataUrl(state.photoImg, filename)
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
                <div className="text-sm font-medium text-muted-foreground">Last captured</div>
                <div className="rounded-md border border-border bg-black p-2">
                  <img
                    src={state.photoImg || "/placeholder.svg?height=200&width=200&query=last-captured-photo"}
                    alt="Last captured photo"
                    className="h-[200px] w-[200px] rounded object-contain"
                  />
                </div>
                <p className="text-xs text-muted-foreground">New photos are downloaded automatically when captured.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
