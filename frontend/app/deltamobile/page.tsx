'use client'

import DriverDashboard from '@/components/driver/DriverDashboard'

export default function DeltaMobilePage() {
  return (
    <DriverDashboard
      vehicleId="ESP32-DELTA"
      vehicleName="Delta Mobile"
      vehicleColor="#ffb347"
      forceMobile={true}
    />
  )
}
