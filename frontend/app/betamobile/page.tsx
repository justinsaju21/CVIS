'use client'

import DriverDashboard from '@/components/driver/DriverDashboard'

export default function BetaMobilePage() {
  return (
    <DriverDashboard
      vehicleId="ESP32-BETA"
      vehicleName="Beta Mobile"
      vehicleColor="#ff4757"
      forceMobile={true}
    />
  )
}
