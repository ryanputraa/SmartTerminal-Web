"use client"

import { useState, useEffect, useRef } from "react"
import { HardwareLayout } from "@/components/hardware-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { HardwareWebSocket, generateUUID } from "@/lib/websocket"
import { CreditCard, Power, PowerOff, AlertCircle, CheckCircle, Play, Square } from "lucide-react"

interface IDCardData {
  nik: string
  nama: string
  propinsi: string
  kewarganegaraan: string
  pekerjaan: string
  statuspernikahan: string
  agams: string
  kabupaten: string
  golonganDarah: string
  kelDesa: string
  kecamatan: string
  tempatLahir: string
  rtrw: string
  alamat: string
  jeniskelamin: string
  photoData: string
  signatureScan: string
  minutiae1: string
  minutiae2: string
}

export default function IDCardPage() {
  const [isConnected, setIsConnected] = useState(false)
  const [isReading, setIsReading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [cardData, setCardData] = useState<IDCardData | null>(null)
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
    setIsReading(false)
    addLog("Disconnected from hardware service")
  }

  const startReading = async () => {
    if (!wsRef.current) return

    try {
      setIsLoading(true)
      setError(null)
      setIsReading(true)
      addLog("Starting ID card reading...")

      const response = await wsRef.current.sendRequest({
        deviceType: "idCard",
        deviceMethods: "startRead",
        uuid: generateUUID(),
      })

      if (response.result === 0) {
        setCardData(response.data)
        addLog("ID card read successfully")
      } else {
        setError(`Failed to read ID card: ${response.msg}`)
        addLog(`ID card reading failed: ${response.msg}`)
        setIsReading(false)
      }
    } catch (err) {
      setError("Error reading ID card")
      addLog("ID card reading error")
      setIsReading(false)
    } finally {
      setIsLoading(false)
    }
  }

  const stopReading = async () => {
    if (!wsRef.current) return

    try {
      setIsLoading(true)
      setError(null)

      await wsRef.current.sendRequest({
        deviceType: "idCard",
        deviceMethods: "stopRead",
        uuid: generateUUID(),
      })

      setIsReading(false)
      addLog("ID card reading stopped")
    } catch (err) {
      setError("Error stopping ID card reading")
      addLog("Stop reading error")
    } finally {
      setIsLoading(false)
    }
  }

  const clearData = () => {
    setCardData(null)
    addLog("Card data cleared")
  }

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect()
      }
    }
  }, [])

  const formatFieldName = (key: string): string => {
    const fieldNames: Record<string, string> = {
      nik: "NIK",
      nama: "Full Name",
      propinsi: "Province",
      kewarganegaraan: "Citizenship",
      pekerjaan: "Occupation",
      statuspernikahan: "Marital Status",
      agams: "Religion",
      kabupaten: "Regency/City",
      golonganDarah: "Blood Type",
      kelDesa: "Village",
      kecamatan: "District",
      tempatLahir: "Place of Birth",
      rtrw: "RT/RW",
      alamat: "Address",
      jeniskelamin: "Gender",
      photoData: "Photo",
      signatureScan: "Signature",
      minutiae1: "Fingerprint 1",
      minutiae2: "Fingerprint 2",
    }
    return fieldNames[key] || key
  }

  return (
    <HardwareLayout title="ID Card Reader Testing">
      <div className="space-y-6">
        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant={isConnected ? "default" : "secondary"}>
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
              <Badge variant={isReading ? "default" : "secondary"}>
                {isReading ? "Reading Active" : "Reading Inactive"}
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

        {/* Reader Controls */}
        <Card>
          <CardHeader>
            <CardTitle>ID Card Reader Controls</CardTitle>
            <CardDescription>Control the ID card reading process</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={startReading}
                disabled={!isConnected || isReading || isLoading}
                variant="default"
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Reading
              </Button>
              <Button onClick={stopReading} disabled={!isConnected || !isReading || isLoading} variant="outline">
                <Square className="h-4 w-4 mr-2" />
                Stop Reading
              </Button>
              <Button onClick={clearData} disabled={!cardData} variant="outline">
                Clear Data
              </Button>
            </div>

            {isReading && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please place the ID card on the reader. The system will automatically detect and read the card data.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Card Data Display */}
        {cardData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Personal Information */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Basic identity information from ID card</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(cardData)
                    .filter(([key]) => !["photoData", "signatureScan", "minutiae1", "minutiae2"].includes(key))
                    .map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <label className="text-sm font-medium text-muted-foreground">{formatFieldName(key)}</label>
                        <div className="p-2 bg-muted rounded border">
                          <span className="text-sm">{value || "N/A"}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Photo and Biometric Data */}
            <Card>
              <CardHeader>
                <CardTitle>Biometric Data</CardTitle>
                <CardDescription>Photo and signature from ID card</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Photo */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Photo</label>
                  {cardData.photoData ? (
                    <img
                      src={`data:image/jpeg;base64,${cardData.photoData}`}
                      alt="ID Card Photo"
                      className="w-full h-32 object-cover rounded border mt-1"
                    />
                  ) : (
                    <div className="w-full h-32 bg-muted rounded border mt-1 flex items-center justify-center">
                      <span className="text-sm text-muted-foreground">No photo data</span>
                    </div>
                  )}
                </div>

                {/* Signature */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Signature</label>
                  {cardData.signatureScan ? (
                    <img
                      src={`data:image/jpeg;base64,${cardData.signatureScan}`}
                      alt="ID Card Signature"
                      className="w-full h-20 object-cover rounded border mt-1"
                    />
                  ) : (
                    <div className="w-full h-20 bg-muted rounded border mt-1 flex items-center justify-center">
                      <span className="text-sm text-muted-foreground">No signature data</span>
                    </div>
                  )}
                </div>

                {/* Fingerprint Data Status */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Fingerprint Data</label>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle className={`h-4 w-4 ${cardData.minutiae1 ? "text-green-500" : "text-gray-400"}`} />
                      <span className="text-sm">Minutiae 1: {cardData.minutiae1 ? "Available" : "Not available"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className={`h-4 w-4 ${cardData.minutiae2 ? "text-green-500" : "text-gray-400"}`} />
                      <span className="text-sm">Minutiae 2: {cardData.minutiae2 ? "Available" : "Not available"}</span>
                    </div>
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
            <CardDescription>Recent ID card reader operations and results</CardDescription>
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
