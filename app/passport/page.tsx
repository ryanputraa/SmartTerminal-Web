"use client"

import { useState, useEffect, useRef } from "react"
import { HardwareLayout } from "@/components/hardware-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HardwareWebSocket, generateUUID } from "@/lib/websocket"
import { FileText, Power, PowerOff, AlertCircle, Play, Square, User, Camera, Eye, Zap } from "lucide-react"

interface PassportData {
  cardMainId: string
  cardName: string
  cardSubId: string
  mrz1: string
  mrz2: string
  ocrMrz: string
  rfidMrz: string
  addressViz: string
  birthPlace: string
  birthPlacePinyin: string
  birthDate: string
  birthDateOcr: string
  aliasViz: string
  nationality: string
  gender: string
  genderOcr: string
  passportNumber: string
  passportNumberMrz: string
  passportType: string
  holderNationalityCode: string
  holderNationalityOcr: string
  expiryDate: string
  expiryDateOcr: string
  nativeGivenName: string
  nativeSurname: string
  nativeName: string
  nativeNameViz: string
  nativeNamePinyinOcr: string
  reviewedEnglishGivenName: string
  reviewedEnglishSurname: string
  guardianName: string
  issuingCountry: string
  issuingPlace: string
  issuingPlacePinyin: string
  issuingDate: string
  issuingAuthority: string
  issuingAuthorityOcr: string
  englishGivenName: string
  englishGivenNameViz: string
  englishSurname: string
  englishSurnameViz: string
  englishName: string
  englishNameViz: string
  idNumberOcr: string
  height: string
  mrzSelectiveData: string
  headImg: string
  colorImg: string
  irImg: string
  uvImg: string
}

export default function PassportPage() {
  const [isConnected, setIsConnected] = useState(false)
  const [isReading, setIsReading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [passportData, setPassportData] = useState<PassportData | null>(null)
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
      addLog("Starting passport reading...")

      const response = await wsRef.current.sendRequest({
        deviceType: "passport",
        deviceMethods: "startRead",
        uuid: generateUUID(),
      })

      if (response.result === 0) {
        setPassportData(response.data)
        addLog("Passport read successfully")
      } else {
        setError(`Failed to read passport: ${response.msg}`)
        addLog(`Passport reading failed: ${response.msg}`)
        setIsReading(false)
      }
    } catch (err) {
      setError("Error reading passport")
      addLog("Passport reading error")
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
        deviceType: "passport",
        deviceMethods: "stopRead",
        uuid: generateUUID(),
      })

      setIsReading(false)
      addLog("Passport reading stopped")
    } catch (err) {
      setError("Error stopping passport reading")
      addLog("Stop reading error")
    } finally {
      setIsLoading(false)
    }
  }

  const clearData = () => {
    setPassportData(null)
    addLog("Passport data cleared")
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
      cardMainId: "Card Main ID",
      cardName: "Document Name",
      cardSubId: "Card Sub ID",
      mrz1: "MRZ Line 1",
      mrz2: "MRZ Line 2",
      ocrMrz: "OCR MRZ",
      rfidMrz: "RFID MRZ",
      addressViz: "Address (VIZ)",
      birthPlace: "Place of Birth",
      birthPlacePinyin: "Place of Birth (Pinyin)",
      birthDate: "Date of Birth",
      birthDateOcr: "Date of Birth (OCR)",
      aliasViz: "Alias (VIZ)",
      nationality: "Nationality",
      gender: "Gender",
      genderOcr: "Gender (OCR)",
      passportNumber: "Passport Number",
      passportNumberMrz: "Passport Number (MRZ)",
      passportType: "Passport Type",
      holderNationalityCode: "Holder Nationality Code",
      holderNationalityOcr: "Holder Nationality (OCR)",
      expiryDate: "Expiry Date",
      expiryDateOcr: "Expiry Date (OCR)",
      nativeGivenName: "Native Given Name",
      nativeSurname: "Native Surname",
      nativeName: "Native Name",
      nativeNameViz: "Native Name (VIZ)",
      nativeNamePinyinOcr: "Native Name Pinyin (OCR)",
      reviewedEnglishGivenName: "Reviewed English Given Name",
      reviewedEnglishSurname: "Reviewed English Surname",
      guardianName: "Guardian Name",
      issuingCountry: "Issuing Country",
      issuingPlace: "Issuing Place",
      issuingPlacePinyin: "Issuing Place (Pinyin)",
      issuingDate: "Issuing Date",
      issuingAuthority: "Issuing Authority",
      issuingAuthorityOcr: "Issuing Authority (OCR)",
      englishGivenName: "English Given Name",
      englishGivenNameViz: "English Given Name (VIZ)",
      englishSurname: "English Surname",
      englishSurnameViz: "English Surname (VIZ)",
      englishName: "English Name",
      englishNameViz: "English Name (VIZ)",
      idNumberOcr: "ID Number (OCR)",
      height: "Height",
      mrzSelectiveData: "MRZ Selective Data",
    }
    return fieldNames[key] || key
  }

  return (
    <HardwareLayout title="Passport Reader Testing">
      <div className="space-y-6">
        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
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
            <CardTitle>Passport Reader Controls</CardTitle>
            <CardDescription>Control the passport reading process</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={startReading}
                disabled={!isConnected || isReading || isLoading}
                variant="default"
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Reading
              </Button>
              <Button onClick={stopReading} disabled={!isConnected || !isReading || isLoading} variant="outline">
                <Square className="h-4 w-4 mr-2" />
                Stop Reading
              </Button>
              <Button onClick={clearData} disabled={!passportData} variant="outline">
                Clear Data
              </Button>
            </div>

            {isReading && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please place the passport on the reader. The system will scan both OCR and RFID data automatically.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Passport Data Display */}
        {passportData && (
          <Card>
            <CardHeader>
              <CardTitle>Passport Data</CardTitle>
              <CardDescription>Comprehensive passport information and images</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="personal" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="personal">Personal Info</TabsTrigger>
                  <TabsTrigger value="document">Document Info</TabsTrigger>
                  <TabsTrigger value="images">Images</TabsTrigger>
                  <TabsTrigger value="technical">Technical Data</TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      "englishName",
                      "englishGivenName",
                      "englishSurname",
                      "nativeName",
                      "nativeGivenName",
                      "nativeSurname",
                      "gender",
                      "birthDate",
                      "birthPlace",
                      "nationality",
                      "height",
                      "guardianName",
                    ].map((key) => (
                      <div key={key} className="space-y-1">
                        <label className="text-sm font-medium text-muted-foreground">{formatFieldName(key)}</label>
                        <div className="p-2 bg-muted rounded border">
                          <span className="text-sm">{passportData[key as keyof PassportData] || "N/A"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="document" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      "passportNumber",
                      "passportType",
                      "cardName",
                      "issuingCountry",
                      "issuingPlace",
                      "issuingDate",
                      "issuingAuthority",
                      "expiryDate",
                      "holderNationalityCode",
                      "cardMainId",
                      "cardSubId",
                    ].map((key) => (
                      <div key={key} className="space-y-1">
                        <label className="text-sm font-medium text-muted-foreground">{formatFieldName(key)}</label>
                        <div className="p-2 bg-muted rounded border">
                          <span className="text-sm">{passportData[key as keyof PassportData] || "N/A"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="images" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Head Image */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4" />
                        <label className="text-sm font-medium">Portrait Photo</label>
                      </div>
                      {passportData.headImg ? (
                        <img
                          src={`data:image/jpeg;base64,${passportData.headImg}`}
                          alt="Passport Photo"
                          className="w-full h-48 object-cover rounded border"
                        />
                      ) : (
                        <div className="w-full h-48 bg-muted rounded border flex items-center justify-center">
                          <span className="text-sm text-muted-foreground">No portrait image</span>
                        </div>
                      )}
                    </div>

                    {/* Color Image */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Camera className="h-4 w-4" />
                        <label className="text-sm font-medium">Color Image</label>
                      </div>
                      {passportData.colorImg ? (
                        <img
                          src={`data:image/jpeg;base64,${passportData.colorImg}`}
                          alt="Color Image"
                          className="w-full h-48 object-cover rounded border"
                        />
                      ) : (
                        <div className="w-full h-48 bg-muted rounded border flex items-center justify-center">
                          <span className="text-sm text-muted-foreground">No color image</span>
                        </div>
                      )}
                    </div>

                    {/* Infrared Image */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="h-4 w-4" />
                        <label className="text-sm font-medium">Infrared Image</label>
                      </div>
                      {passportData.irImg ? (
                        <img
                          src={`data:image/jpeg;base64,${passportData.irImg}`}
                          alt="Infrared Image"
                          className="w-full h-48 object-cover rounded border"
                        />
                      ) : (
                        <div className="w-full h-48 bg-muted rounded border flex items-center justify-center">
                          <span className="text-sm text-muted-foreground">No infrared image</span>
                        </div>
                      )}
                    </div>

                    {/* UV Image */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="h-4 w-4" />
                        <label className="text-sm font-medium">Ultraviolet Image</label>
                      </div>
                      {passportData.uvImg ? (
                        <img
                          src={`data:image/jpeg;base64,${passportData.uvImg}`}
                          alt="UV Image"
                          className="w-full h-48 object-cover rounded border"
                        />
                      ) : (
                        <div className="w-full h-48 bg-muted rounded border flex items-center justify-center">
                          <span className="text-sm text-muted-foreground">No UV image</span>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="technical" className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    {["mrz1", "mrz2", "ocrMrz", "rfidMrz", "mrzSelectiveData"].map((key) => (
                      <div key={key} className="space-y-1">
                        <label className="text-sm font-medium text-muted-foreground">{formatFieldName(key)}</label>
                        <div className="p-3 bg-muted rounded border font-mono text-sm">
                          <span>{passportData[key as keyof PassportData] || "N/A"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Activity Log */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
            <CardDescription>Recent passport reader operations and results</CardDescription>
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
