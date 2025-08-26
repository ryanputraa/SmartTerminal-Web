"use client"

import { useState, useEffect, useRef } from "react"
import { HardwareLayout } from "@/components/hardware-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { HardwareWebSocket, generateUUID } from "@/lib/websocket"
import { PenTool, Power, PowerOff, AlertCircle, CheckCircle, Play, Square, Eye, FileSignature } from "lucide-react"

interface SignatureData {
  previewImg: string
  signImg: string
}

export default function SignaturePage() {
  const [isConnected, setIsConnected] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [signatureData, setSignatureData] = useState<SignatureData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  const wsRef = useRef<HardwareWebSocket | null>(null)

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prev) => [...prev.slice(-9), `[${timestamp}] ${message}`])
  }

  const connectWebSocket = async () => {
    try {
      setIsLoading(true)
      setError(null)

      wsRef.current = new HardwareWebSocket()
      await wsRef.current.connect()

      setIsConnected(true)
      addLog("Connected to hardware service")
    } catch (err) {
      setError("Failed to connect to hardware service. Make sure the service is running on ws://127.0.0.1:8909")
      addLog("Connection failed")
    } finally {
      setIsLoading(false)
    }
  }

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.disconnect()
      wsRef.current = null
    }
    setIsConnected(false)
    setIsSigning(false)
    addLog("Disconnected from hardware service")
  }

  const startSigning = async () => {
    if (!wsRef.current) return

    try {
      setIsLoading(true)
      setError(null)
      setIsSigning(true)
      addLog("Starting signature capture...")

      const response = await wsRef.current.sendRequest({
        deviceType: "sign",
        deviceMethods: "startSign",
        uuid: generateUUID(),
      })

      if (response.result === 0) {
        setSignatureData(response.data)
        addLog("Signature capture started successfully")
      } else {
        setError(`Failed to start signature capture: ${response.msg}`)
        addLog(`Signature capture failed: ${response.msg}`)
        setIsSigning(false)
      }
    } catch (err) {
      setError("Error starting signature capture")
      addLog("Signature capture error")
      setIsSigning(false)
    } finally {
      setIsLoading(false)
    }
  }

  const stopSigning = async () => {
    if (!wsRef.current) return

    try {
      setIsLoading(true)
      setError(null)

      await wsRef.current.sendRequest({
        deviceType: "sign",
        deviceMethods: "stopSign",
        uuid: generateUUID(),
      })

      setIsSigning(false)
      addLog("Signature capture stopped")
    } catch (err) {
      setError("Error stopping signature capture")
      addLog("Stop signing error")
    } finally {
      setIsLoading(false)
    }
  }

  const clearSignature = () => {
    setSignatureData(null)
    addLog("Signature data cleared")
  }

  const saveSignature = () => {
    if (signatureData?.signImg) {
      const link = document.createElement("a")
      link.href = `data:image/jpeg;base64,${signatureData.signImg}`
      link.download = `signature_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.jpg`
      link.click()
      addLog("Signature saved to downloads")
    }
  }

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect()
      }
    }
  }, [])

  return (
    <HardwareLayout title="Signature Pen Testing">
      <div className="space-y-6">
        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5" />
              Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant={isConnected ? "default" : "secondary"}>
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
              <Badge variant={isSigning ? "default" : "secondary"}>
                {isSigning ? "Signing Active" : "Signing Inactive"}
              </Badge>
            </div>

            <div className="flex gap-2">
              {!isConnected ? (
                <Button onClick={connectWebSocket} disabled={isLoading}>
                  <Power className="h-4 w-4 mr-2" />
                  Connect to Hardware Service
                </Button>
              ) : (
                <Button variant="outline" onClick={disconnectWebSocket}>
                  <PowerOff className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Signature Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Signature Pen Controls</CardTitle>
            <CardDescription>Control the digital signature capture process</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={startSigning}
                disabled={!isConnected || isSigning || isLoading}
                variant="default"
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Signing
              </Button>
              <Button onClick={stopSigning} disabled={!isConnected || !isSigning || isLoading} variant="outline">
                <Square className="h-4 w-4 mr-2" />
                Stop Signing
              </Button>
              <Button onClick={clearSignature} disabled={!signatureData} variant="outline">
                Clear Signature
              </Button>
              <Button
                onClick={saveSignature}
                disabled={!signatureData?.signImg}
                variant="secondary"
                className="ml-auto"
              >
                <FileSignature className="h-4 w-4 mr-2" />
                Save Signature
              </Button>
            </div>

            {isSigning && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please use the signature pen to sign on the pad. The system will capture real-time preview and final
                  signature images.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Signature Display */}
        {signatureData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Preview Image */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Live Preview
                </CardTitle>
                <CardDescription>Real-time signature preview</CardDescription>
              </CardHeader>
              <CardContent>
                {signatureData.previewImg ? (
                  <div className="space-y-2">
                    <div className="bg-white p-4 rounded border">
                      <img
                        src={`data:image/jpeg;base64,${signatureData.previewImg}`}
                        alt="Signature Preview"
                        className="w-full h-48 object-contain"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Preview active
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-56 bg-muted rounded border flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <PenTool className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No preview available</p>
                      <p className="text-sm">Start signing to see preview</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Final Signature */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSignature className="h-5 w-5" />
                  Final Signature
                </CardTitle>
                <CardDescription>Captured signature image</CardDescription>
              </CardHeader>
              <CardContent>
                {signatureData.signImg ? (
                  <div className="space-y-2">
                    <div className="bg-white p-4 rounded border">
                      <img
                        src={`data:image/jpeg;base64,${signatureData.signImg}`}
                        alt="Final Signature"
                        className="w-full h-48 object-contain"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Signature captured
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-56 bg-muted rounded border flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <FileSignature className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No signature captured</p>
                      <p className="text-sm">Complete signing to capture</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Signature Quality Check */}
        {signatureData && (
          <Card>
            <CardHeader>
              <CardTitle>Signature Quality Check</CardTitle>
              <CardDescription>Analysis of captured signature data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary mb-1">{signatureData.previewImg ? "✓" : "✗"}</div>
                  <div className="text-sm font-medium">Preview Available</div>
                  <div className="text-xs text-muted-foreground">Real-time capture</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary mb-1">{signatureData.signImg ? "✓" : "✗"}</div>
                  <div className="text-sm font-medium">Signature Captured</div>
                  <div className="text-xs text-muted-foreground">Final image</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary mb-1">
                    {signatureData.previewImg && signatureData.signImg ? "High" : "Low"}
                  </div>
                  <div className="text-sm font-medium">Data Quality</div>
                  <div className="text-xs text-muted-foreground">Overall assessment</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Usage Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Usage Instructions</CardTitle>
            <CardDescription>How to use the signature pen effectively</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                  1
                </div>
                <div>
                  <div className="font-medium">Connect and Start</div>
                  <div className="text-muted-foreground">
                    Connect to the hardware service and click "Start Signing" to activate the signature pad.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                  2
                </div>
                <div>
                  <div className="font-medium">Sign Naturally</div>
                  <div className="text-muted-foreground">
                    Use the signature pen to sign naturally on the pad. The preview will show your signature in
                    real-time.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                  3
                </div>
                <div>
                  <div className="font-medium">Capture and Save</div>
                  <div className="text-muted-foreground">
                    The final signature will be captured automatically. Use "Save Signature" to download the image.
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Log */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
            <CardDescription>Recent signature pen operations and results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4 h-32 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-muted-foreground text-sm">No activity yet</p>
              ) : (
                <div className="space-y-1">
                  {logs.map((log, index) => (
                    <p key={index} className="text-sm font-mono">
                      {log}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </HardwareLayout>
  )
}
