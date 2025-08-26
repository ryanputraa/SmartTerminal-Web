"use client"

import { useState, useEffect, useRef } from "react"
import { HardwareLayout } from "@/components/hardware-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { HardwareWebSocket, generateUUID } from "@/lib/websocket"
import { Fingerprint, Power, PowerOff, AlertCircle, CheckCircle, Play, Square, Eye } from "lucide-react"

interface FingerprintData {
  previewImg: string
  captureImg: string
  leftIndexImg: string
  leftMiddleImg: string
  leftRingImg: string
  leftLittleImg: string
}

export default function FingerprintPage() {
  const [isConnected, setIsConnected] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [fingerprintData, setFingerprintData] = useState<FingerprintData | null>(null)
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
    setIsScanning(false)
    addLog("Disconnected from hardware service")
  }

  const startScanning = async () => {
    if (!wsRef.current) return

    try {
      setIsLoading(true)
      setError(null)
      setIsScanning(true)
      addLog("Starting fingerprint scanning...")

      const response = await wsRef.current.sendRequest({
        deviceType: "finger",
        deviceMethods: "startScan",
        uuid: generateUUID(),
      })

      if (response.result === 0) {
        setFingerprintData(response.data)
        addLog("Fingerprint scanning completed successfully")
      } else {
        setError(`Failed to scan fingerprints: ${response.msg}`)
        addLog(`Fingerprint scanning failed: ${response.msg}`)
        setIsScanning(false)
      }
    } catch (err) {
      setError("Error during fingerprint scanning")
      addLog("Fingerprint scanning error")
      setIsScanning(false)
    } finally {
      setIsLoading(false)
    }
  }

  const stopScanning = async () => {
    if (!wsRef.current) return

    try {
      setIsLoading(true)
      setError(null)

      await wsRef.current.sendRequest({
        deviceType: "finger",
        deviceMethods: "stopScan",
        uuid: generateUUID(),
      })

      setIsScanning(false)
      addLog("Fingerprint scanning stopped")
    } catch (err) {
      setError("Error stopping fingerprint scanning")
      addLog("Stop scanning error")
    } finally {
      setIsLoading(false)
    }
  }

  const clearData = () => {
    setFingerprintData(null)
    addLog("Fingerprint data cleared")
  }

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect()
      }
    }
  }, [])

  const fingerNames = {
    leftIndexImg: "Left Index Finger",
    leftMiddleImg: "Left Middle Finger",
    leftRingImg: "Left Ring Finger",
    leftLittleImg: "Left Little Finger",
  }

  return (
    <HardwareLayout title="Fingerprint Scanner Testing">
      <div className="space-y-6">
        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5" />
              Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant={isConnected ? "default" : "secondary"}>
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
              <Badge variant={isScanning ? "default" : "secondary"}>
                {isScanning ? "Scanning Active" : "Scanning Inactive"}
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

        {/* Scanner Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Fingerprint Scanner Controls</CardTitle>
            <CardDescription>Control the fingerprint scanning process</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={startScanning}
                disabled={!isConnected || isScanning || isLoading}
                variant="default"
                className="bg-red-600 hover:bg-red-700"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Scanning
              </Button>
              <Button onClick={stopScanning} disabled={!isConnected || !isScanning || isLoading} variant="outline">
                <Square className="h-4 w-4 mr-2" />
                Stop Scanning
              </Button>
              <Button onClick={clearData} disabled={!fingerprintData} variant="outline">
                Clear Data
              </Button>
            </div>

            {isScanning && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please place your left hand fingers on the scanner. The system will capture individual fingerprints
                  and provide preview images.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Fingerprint Data Display */}
        {fingerprintData && (
          <div className="space-y-6">
            {/* Preview and Capture Images */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Preview Image */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Live Preview
                  </CardTitle>
                  <CardDescription>Real-time scanner preview</CardDescription>
                </CardHeader>
                <CardContent>
                  {fingerprintData.previewImg ? (
                    <div className="space-y-2">
                      <img
                        src={`data:image/jpeg;base64,${fingerprintData.previewImg}`}
                        alt="Fingerprint Preview"
                        className="w-full h-64 object-cover rounded border"
                      />
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Preview active
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-64 bg-muted rounded border flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <Fingerprint className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No preview available</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Capture Image */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Fingerprint className="h-5 w-5" />
                    Captured Image
                  </CardTitle>
                  <CardDescription>Main fingerprint capture</CardDescription>
                </CardHeader>
                <CardContent>
                  {fingerprintData.captureImg ? (
                    <div className="space-y-2">
                      <img
                        src={`data:image/jpeg;base64,${fingerprintData.captureImg}`}
                        alt="Captured Fingerprint"
                        className="w-full h-64 object-cover rounded border"
                      />
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Fingerprint captured
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-64 bg-muted rounded border flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <Fingerprint className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No capture available</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Individual Finger Images */}
            <Card>
              <CardHeader>
                <CardTitle>Individual Finger Scans</CardTitle>
                <CardDescription>Left hand finger impressions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(fingerNames).map(([key, name]) => (
                    <div key={key} className="space-y-2">
                      <h4 className="text-sm font-medium text-center">{name}</h4>
                      {fingerprintData[key as keyof FingerprintData] ? (
                        <div className="space-y-2">
                          <img
                            src={`data:image/jpeg;base64,${fingerprintData[key as keyof FingerprintData]}`}
                            alt={name}
                            className="w-full h-32 object-cover rounded border"
                          />
                          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span>Captured</span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-32 bg-muted rounded border flex items-center justify-center">
                          <div className="text-center text-muted-foreground">
                            <Fingerprint className="h-6 w-6 mx-auto mb-1 opacity-50" />
                            <p className="text-xs">No scan</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Scan Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Scan Summary</CardTitle>
                <CardDescription>Overview of captured fingerprint data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{fingerprintData.previewImg ? "✓" : "✗"}</div>
                    <div className="text-sm text-muted-foreground">Preview Image</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{fingerprintData.captureImg ? "✓" : "✗"}</div>
                    <div className="text-sm text-muted-foreground">Capture Image</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {
                        Object.entries(fingerNames).filter(([key]) => fingerprintData[key as keyof FingerprintData])
                          .length
                      }
                      /4
                    </div>
                    <div className="text-sm text-muted-foreground">Individual Fingers</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Activity Log */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
            <CardDescription>Recent fingerprint scanner operations and results</CardDescription>
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
