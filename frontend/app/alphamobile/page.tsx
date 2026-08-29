'use client'

import DriverDashboard from '@/components/driver/DriverDashboard'
import MobileAccessGate from '@/components/mobile/MobileAccessGate'

export default function AlphaMobilePage() {
  return (
    <MobileAccessGate vehicleId="ESP32-ALPHA" vehicleName="Alpha">
      <DriverDashboard
        vehicleId="ESP32-ALPHA"
        vehicleName="Alpha Mobile"
        vehicleColor="#00d4ff"
        forceMobile={true}
      />
    </MobileAccessGate>
  )
}
