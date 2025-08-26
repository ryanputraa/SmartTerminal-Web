"use client"

import { useState, useEffect, useRef } from "react"
import { HardwareLayout } from "@/components/hardware-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { HardwareWebSocket, generateUUID } from "@/lib/websocket"
import { Camera, Power, PowerOff, AlertCircle, CheckCircle } from "lucide-react"

export default function HighSpeedCameraPage() {
  const [isConnected, setIsConnected] = useState(false)
  const [isDeviceOpen, setIsDeviceOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
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
    setIsDeviceOpen(false)
    setPreviewImage(null)
    addLog("Disconnected from hardware service")
  }

  const openCamera = async () => {
    if (!wsRef.current) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await wsRef.current.sendRequest({
        deviceType: "highCamera",
        deviceMethods: "open",
        uuid: generateUUID(),
      })

      if (response.result === 0) {
        setIsDeviceOpen(true)
        if (response.data?.previewImg) {
          setPreviewImage(`data:image/jpeg;base64,${response.data.previewImg}`)
        }
        addLog("High-speed camera opened successfully")
      } else {
        setError(`Failed to open camera: ${response.msg}`)
        addLog(`Camera open failed: ${response.msg}`)
      }
    } catch (err) {
      setError("Error opening camera")
      addLog("Camera open error")
    } finally {
      setIsLoading(false)
    }
  }

  const takePhoto = async () => {
    if (!wsRef.current) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await wsRef.current.sendRequest({
        deviceType: "highCamera",
        deviceMethods: "takePhoto",
        uuid: generateUUID(),
      })

      if (response.result === 0) {
        if (response.data?.photoImg) {
          setCapturedImage(`data:image/jpeg;base64,${response.data.photoImg}`)
        }
        addLog("Photo captured successfully")
      } else {
        setError(`Failed to take photo: ${response.msg}`)
        addLog(`Photo capture failed: ${response.msg}`)
      }
    } catch (err) {
      setError("Error taking photo")
      addLog("Photo capture error")
    } finally {
      setIsLoading(false)
    }
  }

  const closeCamera = async () => {
    if (!wsRef.current) return

    try {
      setIsLoading(true)
      setError(null)

      await wsRef.current.sendRequest({
        deviceType: "highCamera",
        deviceMethods: "close",
        uuid: generateUUID(),
      })

      setIsDeviceOpen(false)
      setPreviewImage(null)
      addLog("High-speed camera closed")
    } catch (err) {
      setError("Error closing camera")
      addLog("Camera close error")
    } finally {
      setIsLoading(false)
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
    <HardwareLayout title="High-Speed Camera Testing">
      <div className="space-y-6">
        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant={isConnected ? "default" : "secondary"}>
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
              <Badge variant={isDeviceOpen ? "default" : "secondary"}>
                {isDeviceOpen ? "Camera Open" : "Camera Closed"}
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

        {/* Camera Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Camera Controls</CardTitle>
            <CardDescription>Control the high-speed camera device</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={openCamera} disabled={!isConnected || isDeviceOpen || isLoading} variant="default">
                Open Camera
              </Button>
              <Button onClick={takePhoto} disabled={!isConnected || !isDeviceOpen || isLoading} variant="default">
                Take Photo
              </Button>
              <Button onClick={closeCamera} disabled={!isConnected || !isDeviceOpen || isLoading} variant="outline">
                Close Camera
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Image Display */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Preview Image */}
          <Card>
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>Real-time camera preview</CardDescription>
            </CardHeader>
            <CardContent>
              {previewImage ? (
                <div className="space-y-2">
                  <img
                    src={previewImage || "/placeholder.svg"}
                    alt="Camera Preview"
                    className="w-full h-64 object-cover rounded-lg border"
                  />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Preview active
                  </div>
                </div>
              ) : (
                <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No preview available</p>
                    <p className="text-sm">Open camera to see preview</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Captured Image */}
          <Card>
            <CardHeader>
              <CardTitle>Captured Photo</CardTitle>
              <CardDescription>Last captured high-speed photo</CardDescription>
            </CardHeader>
            <CardContent>
              {capturedImage ? (
                <div className="space-y-2">
                  <img
                    src={capturedImage || "/placeholder.svg"}
                    alt="Captured Photo"
                    className="w-full h-64 object-cover rounded-lg border"
                  />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Photo captured
                  </div>
                </div>
              ) : (
                <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No photo captured</p>
                    <p className="text-sm">Take a photo to see result</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activity Log */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
            <CardDescription>Recent camera operations and responses</CardDescription>
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
