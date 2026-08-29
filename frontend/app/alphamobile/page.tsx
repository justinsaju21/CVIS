'use client'

import DriverDashboard from '@/components/driver/DriverDashboard'

export default function AlphaMobilePage() {
  return (
    <DriverDashboard
      vehicleId="ESP32-ALPHA"
      vehicleName="Alpha Mobile"
      vehicleColor="#00d4ff"
      forceMobile={true}
    />
  )
}
