export interface HardwareRequest {
  deviceType: string
  deviceMethods: string
  uuid: string
}

export interface HardwareResponse {
  uuid: string
  func: string
  msg: string
  result: number
  data?: any
}

export class HardwareWebSocket {
  private ws: WebSocket | null = null
  private url = "ws://127.0.0.1:8909"
  private messageHandlers = new Map<string, (response: HardwareResponse) => void>()

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log("[v0] WebSocket connected to hardware service")
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const response: HardwareResponse = JSON.parse(event.data)
            console.log("[v0] Received hardware response:", response)

            const handler = this.messageHandlers.get(response.uuid)
            if (handler) {
              handler(response)
              this.messageHandlers.delete(response.uuid)
            }
          } catch (error) {
            console.error("[v0] Error parsing WebSocket message:", error)
          }
        }

        this.ws.onerror = (error) => {
          console.error("[v0] WebSocket error:", error)
          reject(error)
        }

        this.ws.onclose = () => {
          console.log("[v0] WebSocket connection closed")
          this.ws = null
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.messageHandlers.clear()
  }

  sendRequest(request: HardwareRequest): Promise<HardwareResponse> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket not connected"))
        return
      }

      // Generate UUID if not provided
      if (!request.uuid) {
        request.uuid = Math.random().toString(36).substr(2, 5)
      }

      // Set up response handler
      this.messageHandlers.set(request.uuid, resolve)

      // Send request
      this.ws.send(JSON.stringify(request))
      console.log("[v0] Sent hardware request:", request)

      // Set timeout for request
      setTimeout(() => {
        if (this.messageHandlers.has(request.uuid)) {
          this.messageHandlers.delete(request.uuid)
          reject(new Error("Request timeout"))
        }
      }, 10000) // 10 second timeout
    })
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}

// Utility function to generate UUID
export function generateUUID(): string {
  return Math.random().toString(36).substr(2, 5)
}
