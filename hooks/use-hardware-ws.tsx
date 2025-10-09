"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type IdCardData = Record<string, any> | null
type PassportData = Record<string, any> | null

export type HardwareState = {
  // Camera
  cameraPreview?: string
  faceImg?: string

  // High-speed camera
  highPreview?: string
  photoImg?: string

  // ID Card
  idCardData: IdCardData

  // Passport
  passportData: PassportData
  passportHead?: string
  passportColor?: string
  passportIr?: string
  passportUv?: string

  // Fingerprint
  fingerPreview?: string
  fingerCapture?: string
  leftIndexImg?: string
  leftMiddleImg?: string
  leftRingImg?: string
  leftLittleImg?: string

  // Signature
  signPreview?: string
  signImg?: string
}

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

export function useHardwareWS() {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<HardwareState>({ idCardData: null, passportData: null })
  const wsRef = useRef<WebSocket | null>(null)

  const make5DigitUuid = () => Math.floor(10000 + Math.random() * 90000).toString()

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket("ws://127.0.0.1:8909")
      wsRef.current = ws

      ws.onopen = () => {
        console.log("[v0] WS connected")
        setConnected(true)
        setError(null)
      }

      ws.onclose = () => {
        console.log("[v0] WS closed")
        setConnected(false)
      }

      ws.onerror = (evt) => {
        console.log("[v0] WS error", evt)
        setError("WebSocket error")
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          // console.log("[v0] Received:", msg)

          if (!msg || typeof msg !== "object") return
          const func: string | undefined = msg.func
          const data = msg.data || {}

          setState((prev) => {
            const next = { ...prev }

            // Camera
            if (func?.startsWith("camera-open") && data.previewImg) {
              next.cameraPreview = "data:image/jpeg;base64," + data.previewImg
            }
            if (data.faceImg) {
              next.faceImg = "data:image/jpeg;base64," + data.faceImg
            }

            // High-speed camera
            if (func?.startsWith("highCamera-open") && data.previewImg) {
              next.highPreview = "data:image/jpeg;base64," + data.previewImg
            }
            if (data.photoImg) {
              next.photoImg = "data:image/jpeg;base64," + data.photoImg
            }

            // ID Card
            if (func?.startsWith("idCard-startRead")) {
              next.idCardData = data || null
            }

            // Passport
            if (func?.startsWith("passport-startRead")) {
              next.passportData = data || null
              if (data.headImg) next.passportHead = "data:image/jpeg;base64," + data.headImg
              if (data.colorImg) next.passportColor = "data:image/jpeg;base64," + data.colorImg
              if (data.irImg) next.passportIr = "data:image/jpeg;base64," + data.irImg
              if (data.uvImg) next.passportUv = "data:image/jpeg;base64," + data.uvImg
            }

            // Fingerprint
            if (func?.startsWith("finger-startScan")) {
              if (data.previewImg) next.fingerPreview = "data:image/jpeg;base64," + data.previewImg
              if (data.captureImg) next.fingerCapture = "data:image/jpeg;base64," + data.captureImg
              if (data.leftIndexImg) next.leftIndexImg = "data:image/jpeg;base64," + data.leftIndexImg
              if (data.leftMiddleImg) next.leftMiddleImg = "data:image/jpeg;base64," + data.leftMiddleImg
              if (data.leftRingImg) next.leftRingImg = "data:image/jpeg;base64," + data.leftRingImg
              if (data.leftLittleImg) next.leftLittleImg = "data:image/jpeg;base64," + data.leftLittleImg
            }

            // Signature
            if (func?.startsWith("sign-startSign")) {
              if (data.previewImg) next.signPreview = "data:image/jpeg;base64," + data.previewImg
              if (data.signImg) next.signImg = "data:image/jpeg;base64," + data.signImg
            }

            return next
          })
        } catch (e: any) {
          console.log("[v0] parse error:", e?.message)
        }
      }
    } catch (e: any) {
      console.log("[v0] WS connect exception:", e?.message)
      setError("Unable to open WebSocket")
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
    }
  }, [connect])

  const sendCmd: SendCmd = useCallback((deviceType, deviceMethods) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError("WebSocket not connected")
      return
    }
    const payload = { deviceType, deviceMethods, uuid: make5DigitUuid() }
    console.log("[v0] Sent:", payload)
    ws.send(JSON.stringify(payload))
  }, [])

  const statusText = useMemo(() => (connected ? "Connected" : "Disconnected"), [connected])

  return { connected, statusText, error, state, sendCmd }
}
