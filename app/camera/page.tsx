"use client"

import { useState, useEffect, useRef } from "react"
import { HardwareLayout } from "@/components/hardware-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { HardwareWebSocket, generateUUID } from "@/lib/websocket"
import { Camera, Power, PowerOff, AlertCircle, CheckCircle, User } from "lucide-react"

export default function CameraPage() {
  const [isConnected, setIsConnected] = useState(false)
  const [isDeviceOpen, setIsDeviceOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [faceImage, setFaceImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [isDetecting, setIsDetecting] = useState(false)

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
        deviceType: "camera",
        deviceMethods: "open",
        uuid: generateUUID(),
      })

      if (response.result === 0) {
        setIsDeviceOpen(true)
        if (response.data?.previewImg) {
          setPreviewImage(`data:image/jpeg;base64,${response.data.previewImg}`)
        }
        addLog("Camera opened successfully")
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

  const detectFace = async () => {
    if (!wsRef.current) return

    try {
      setIsDetecting(true)
      setError(null)
      addLog("Starting face detection...")

      const response = await wsRef.current.sendRequest({
        deviceType: "camera",
        deviceMethods: "faceDetection",
        uuid: generateUUID(),
      })

      if (response.result === 0) {
        if (response.data?.faceImg) {
          setFaceImage(`data:image/jpeg;base64,${response.data.faceImg}`)
        }
        addLog("Face detected and captured successfully")
      } else {
        setError(`Face detection failed: ${response.msg}`)
        addLog(`Face detection failed: ${response.msg}`)
      }
    } catch (err) {
      setError("Error during face detection")
      addLog("Face detection error")
    } finally {
      setIsDetecting(false)
    }
  }

  const closeCamera = async () => {
    if (!wsRef.current) return

    try {
      setIsLoading(true)
      setError(null)

      await wsRef.current.sendRequest({
        deviceType: "camera",
        deviceMethods: "close",
        uuid: generateUUID(),
      })

      setIsDeviceOpen(false)
      setPreviewImage(null)
      addLog("Camera closed")
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
    <HardwareLayout title="Regular Camera Testing">
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
              {isDetecting && (
                <Badge variant="outline" className="animate-pulse">
                  Detecting Face...
                </Badge>
              )}
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
            <CardDescription>Control the camera device and face detection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={openCamera} disabled={!isConnected || isDeviceOpen || isLoading} variant="default">
                Open Camera
              </Button>
              <Button
                onClick={detectFace}
                disabled={!isConnected || !isDeviceOpen || isDetecting}
                variant="default"
                className="bg-green-600 hover:bg-green-700"
              >
                <User className="h-4 w-4 mr-2" />
                {isDetecting ? "Detecting..." : "Detect Face"}
              </Button>
              <Button onClick={closeCamera} disabled={!isConnected || !isDeviceOpen || isLoading} variant="outline">
                Close Camera
              </Button>
            </div>

            {isDeviceOpen && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Face detection may take a few seconds to ensure clear recognition. Position your face clearly in front
                  of the camera.
                </AlertDescription>
              </Alert>
            )}
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

          {/* Face Detection Result */}
          <Card>
            <CardHeader>
              <CardTitle>Face Detection Result</CardTitle>
              <CardDescription>Captured face image from detection</CardDescription>
            </CardHeader>
            <CardContent>
              {faceImage ? (
                <div className="space-y-2">
                  <img
                    src={faceImage || "/placeholder.svg"}
                    alt="Detected Face"
                    className="w-full h-64 object-cover rounded-lg border"
                  />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Face detected successfully
                  </div>
                </div>
              ) : (
                <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No face detected</p>
                    <p className="text-sm">Use face detection to capture</p>
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
            <CardDescription>Recent camera operations and face detection results</CardDescription>
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
