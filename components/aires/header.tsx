"use client"

import Image from "next/image"

export function Header({ status }: { status: "Connected" | "Disconnected" }) {
  const isUp = status === "Connected"
  return (
    <header className="w-full border-b border-border bg-card text-card-foreground">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Image src="/images/aires-logo.png" alt="AIRES SmartTerminal Logo" width={36} height={36} priority />
          <h1 className="text-pretty text-lg font-semibold tracking-tight">AIRES SmartTerminal</h1>
        </div>
        <div
          aria-live="polite"
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm ${
            isUp ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          <span className="mr-2 h-2 w-2 rounded-full bg-white/90" />
          {status}
        </div>
      </div>
    </header>
  )
}
