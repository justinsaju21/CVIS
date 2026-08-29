'use client'

import DriverDashboard from '@/components/driver/DriverDashboard'
import MobileAccessGate from '@/components/mobile/MobileAccessGate'

export default function DeltaMobilePage() {
  return (
    <MobileAccessGate vehicleId="ESP32-DELTA" vehicleName="Delta">
      <DriverDashboard
        vehicleId="ESP32-DELTA"
        vehicleName="Delta Mobile"
        vehicleColor="#ffb347"
        forceMobile={true}
      />
    </MobileAccessGate>
  )
}
