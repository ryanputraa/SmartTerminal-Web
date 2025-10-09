"use client"

import { Header } from "@/components/aires/header"
import { useHardwareWS } from "@/hooks/use-hardware-ws"
import {
  CameraPanel,
  HighCameraPanel,
  IdCardPanel,
  PassportPanel,
  FingerPanel,
  SignPanel,
} from "@/components/aires/panels"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function Page() {
  const { connected, statusText, error, state, sendCmd } = useHardwareWS()

  return (
    <main className="min-h-dvh">
      <Header status={statusText as "Connected" | "Disconnected"} />
      <section className="mx-auto max-w-6xl p-4">
        {!connected && (
          <Alert className="mb-4" variant="destructive">
            <AlertTitle>WebSocket not connected</AlertTitle>
            <AlertDescription>
              Ensure the hardware service is running at {"ws://127.0.0.1:8909"}. {error ? `Error: ${error}` : ""}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CameraPanel s={state} send={sendCmd} />
          <HighCameraPanel s={state} send={sendCmd} />
          <IdCardPanel s={state} send={sendCmd} />
          <PassportPanel s={state} send={sendCmd} />
          <FingerPanel s={state} send={sendCmd} />
          <SignPanel s={state} send={sendCmd} />
        </div>
      </section>
    </main>
  )
}
