"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { HardwareState } from "@/hooks/use-hardware-ws"

type SendCmd = (
  deviceType: "camera" | "highCamera" | "idCard" | "passport" | "finger" | "sign",
  deviceMethods:
    | "open"
    | "faceDetection"
    | "close"
    | "takePhoto"
    | "startRead"
    | "stopRead"
    | "startScan"
    | "stopScan"
    | "startSign"
    | "stopSign",
) => void

export function CameraPanel({ s, send }: { s: HardwareState; send: SendCmd }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Camera</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <img
            src={s.cameraPreview || "/placeholder.svg?height=200&width=320&query=camera-preview"}
            alt="Camera preview"
            className="h-56 w-full rounded-md border border-border object-contain bg-black"
          />
          <img
            src={s.faceImg || "/placeholder.svg?height=200&width=320&query=face-detection"}
            alt="Face detection image"
            className="h-56 w-full rounded-md border border-border object-contain bg-black"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => send("camera", "open")}>Open</Button>
          <Button variant="secondary" onClick={() => send("camera", "faceDetection")}>
            Face Detection
          </Button>
          <Button variant="destructive" onClick={() => send("camera", "close")}>
            Close
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function HighCameraPanel({ s, send }: { s: HardwareState; send: SendCmd }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>High-Speed Camera</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <img
            src={s.highPreview || "/placeholder.svg?height=200&width=320&query=high-speed-preview"}
            alt="High-speed camera preview"
            className="h-56 w-full rounded-md border border-border object-contain bg-black"
          />
          <img
            src={s.photoImg || "/placeholder.svg?height=200&width=320&query=high-speed-photo"}
            alt="High-speed captured photo"
            className="h-56 w-full rounded-md border border-border object-contain bg-black"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => send("highCamera", "open")}>Open</Button>
          <Button variant="secondary" onClick={() => send("highCamera", "takePhoto")}>
            Take Photo
          </Button>
          <Button variant="destructive" onClick={() => send("highCamera", "close")}>
            Close
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function IdCardPanel({ s, send }: { s: HardwareState; send: SendCmd }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ID Card</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted p-3 text-sm">
          {JSON.stringify(s.idCardData ?? { info: "No data" }, null, 2)}
        </pre>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => send("idCard", "startRead")}>Start Read</Button>
          <Button variant="destructive" onClick={() => send("idCard", "stopRead")}>
            Stop Read
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function PassportPanel({ s, send }: { s: HardwareState; send: SendCmd }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Passport</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted p-3 text-sm">
          {JSON.stringify(s.passportData ?? { info: "No data" }, null, 2)}
        </pre>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <img
            src={s.passportHead || "/placeholder.svg?height=200&width=320&query=passport-head"}
            alt="Passport head image"
            className="h-56 w-full rounded-md border border-border object-contain bg-black"
          />
          <img
            src={s.passportColor || "/placeholder.svg?height=200&width=320&query=passport-color"}
            alt="Passport color image"
            className="h-56 w-full rounded-md border border-border object-contain bg-black"
          />
          <img
            src={s.passportIr || "/placeholder.svg?height=200&width=320&query=passport-infrared"}
            alt="Passport infrared image"
            className="h-56 w-full rounded-md border border-border object-contain bg-black"
          />
          <img
            src={s.passportUv || "/placeholder.svg?height=200&width=320&query=passport-ultraviolet"}
            alt="Passport ultraviolet image"
            className="h-56 w-full rounded-md border border-border object-contain bg-black"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => send("passport", "startRead")}>Start Read</Button>
          <Button variant="destructive" onClick={() => send("passport", "stopRead")}>
            Stop Read
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function FingerPanel({ s, send }: { s: HardwareState; send: SendCmd }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fingerprint Reader</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <img
            src={s.fingerPreview || "/placeholder.svg?height=200&width=320&query=fingerprint-preview"}
            alt="Fingerprint preview"
            className="h-56 w-full rounded-md border border-border object-contain bg-black"
          />
          <img
            src={s.fingerCapture || "/placeholder.svg?height=200&width=320&query=fingerprint-capture"}
            alt="Fingerprint capture"
            className="h-56 w-full rounded-md border border-border object-contain bg-black"
          />
          <div className="grid grid-cols-2 gap-3">
            <img
              src={s.leftIndexImg || "/placeholder.svg?height=100&width=160&query=left-index"}
              alt="Left index finger"
              className="h-28 w-full rounded-md border border-border object-contain bg-black"
            />
            <img
              src={s.leftMiddleImg || "/placeholder.svg?height=100&width=160&query=left-middle"}
              alt="Left middle finger"
              className="h-28 w-full rounded-md border border-border object-contain bg-black"
            />
            <img
              src={s.leftRingImg || "/placeholder.svg?height=100&width=160&query=left-ring"}
              alt="Left ring finger"
              className="h-28 w-full rounded-md border border-border object-contain bg-black"
            />
            <img
              src={s.leftLittleImg || "/placeholder.svg?height=100&width=160&query=left-little"}
              alt="Left little finger"
              className="h-28 w-full rounded-md border border-border object-contain bg-black"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => send("finger", "startScan")}>Start Scan</Button>
          <Button variant="destructive" onClick={() => send("finger", "stopScan")}>
            Stop Scan
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function SignPanel({ s, send }: { s: HardwareState; send: SendCmd }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Signature Pen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <img
            src={s.signPreview || "/placeholder.svg?height=200&width=320&query=signature-preview"}
            alt="Signature preview"
            className="h-56 w-full rounded-md border border-border object-contain bg-black"
          />
          <img
            src={s.signImg || "/placeholder.svg?height=200&width=320&query=signature-final"}
            alt="Signature image"
            className="h-56 w-full rounded-md border border-border object-contain bg-black"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => send("sign", "startSign")}>Start Signing</Button>
          <Button variant="destructive" onClick={() => send("sign", "stopSign")}>
            Stop Signing
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
