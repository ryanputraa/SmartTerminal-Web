import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Camera, CreditCard, FileText, Fingerprint, PenTool, Zap } from "lucide-react"

const hardwareDevices = [
  {
    id: "high-speed-camera",
    title: "High-Speed Camera",
    description: "Test high-speed camera functionality including preview and photo capture",
    icon: Zap,
    href: "/high-speed-camera",
    color: "bg-blue-500",
  },
  {
    id: "camera",
    title: "Regular Camera",
    description: "Test camera preview and face detection capabilities",
    icon: Camera,
    href: "/camera",
    color: "bg-green-500",
  },
  {
    id: "id-card",
    title: "ID Card Reader",
    description: "Test ID card reading functionality and data extraction",
    icon: CreditCard,
    href: "/id-card",
    color: "bg-purple-500",
  },
  {
    id: "passport",
    title: "Passport Reader",
    description: "Test passport scanning and comprehensive data extraction",
    icon: FileText,
    href: "/passport",
    color: "bg-orange-500",
  },
  {
    id: "fingerprint",
    title: "Fingerprint Scanner",
    description: "Test fingerprint capture and multi-finger scanning",
    icon: Fingerprint,
    href: "/fingerprint",
    color: "bg-red-500",
  },
  {
    id: "signature",
    title: "Signature Pen",
    description: "Test digital signature capture and preview functionality",
    icon: PenTool,
    href: "/signature",
    color: "bg-indigo-500",
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">Hardware Testing Dashboard</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Comprehensive testing suite for workstation hardware components. Select a device below to test its
            functionality.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hardwareDevices.map((device) => {
            const IconComponent = device.icon
            return (
              <Card key={device.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg ${device.color}`}>
                      <IconComponent className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-xl">{device.title}</CardTitle>
                  </div>
                  <CardDescription className="text-sm">{device.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={device.href}>
                    <Button className="w-full">Test Device</Button>
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="mt-12 text-center">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Connection Status</CardTitle>
              <CardDescription>WebSocket connection to hardware service</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-2">
                <div className="h-3 w-3 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-muted-foreground">ws://127.0.0.1:8909 - Ready to connect</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
