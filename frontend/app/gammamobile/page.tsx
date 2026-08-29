'use client'

import DriverDashboard from '@/components/driver/DriverDashboard'
import MobileAccessGate from '@/components/mobile/MobileAccessGate'

export default function GammaMobilePage() {
  return (
    <MobileAccessGate vehicleId="ESP32-GAMMA" vehicleName="Gamma">
      <DriverDashboard
        vehicleId="ESP32-GAMMA"
        vehicleName="Gamma Mobile"
        vehicleColor="#2ed573"
        forceMobile={true}
      />
    </MobileAccessGate>
  )
}
