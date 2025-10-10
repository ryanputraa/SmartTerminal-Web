"use client"

import Link from "next/link"
import { Header } from "@/components/aires/header"
import { useHardwareWS } from "@/hooks/use-hardware-ws"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function Page() {
  const { statusText } = useHardwareWS()

  return (
    <main className="min-h-dvh">
      <Header status={statusText as "Connected" | "Disconnected"} />
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-10 max-w-3xl">
          <h2 className="text-pretty text-3xl font-semibold leading-tight">AIRES SmartTerminal</h2>
          <p className="mt-2 text-muted-foreground">
            Choose a device to begin. Use the Camera for face detection, or the High‑Speed Camera (Scanner) to capture
            and auto‑download photos.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="transition hover:shadow-lg">
            <CardHeader>
              <CardTitle className="text-balance text-2xl">Camera</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-4">
              <p className="text-muted-foreground">
                Live preview with on-demand face detection. Detection results appear on the right in a compact preview.
              </p>
              <Button asChild className="mt-1">
                <Link href="/camera">Open Camera</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition hover:shadow-lg">
            <CardHeader>
              <CardTitle className="text-balance text-2xl">High‑Speed Camera (Scanner)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-4">
              <p className="text-muted-foreground">
                Scan documents or items. Each captured photo will automatically download to your device.
              </p>
              <Button asChild className="mt-1">
                <Link href="/scanner">Open Scanner</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
