'use client'

import DriverDashboard from '@/components/driver/DriverDashboard'

export default function GammaMobilePage() {
  return (
    <DriverDashboard
      vehicleId="ESP32-GAMMA"
      vehicleName="Gamma Mobile"
      vehicleColor="#2ed573"
      forceMobile={true}
    />
  )
}
