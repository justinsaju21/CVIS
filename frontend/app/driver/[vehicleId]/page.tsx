'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import DriverDashboard from '@/components/driver/DriverDashboard'

const VEHICLE_MAP: Record<string, { deviceId: string; name: string; color: string }> = {
  alpha: { deviceId: 'ESP32-ALPHA', name: 'Alpha',  color: '#00d4ff' },
  beta:  { deviceId: 'ESP32-BETA',  name: 'Beta',   color: '#ff4757' },
  gamma: { deviceId: 'ESP32-GAMMA', name: 'Gamma',  color: '#2ed573' },
  delta: { deviceId: 'ESP32-DELTA', name: 'Delta',  color: '#ffb347' },
}

export default function VehiclePage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = use(params)
  const normalizedId = vehicleId.toLowerCase().replace(/^esp32-/, '')
  const vehicle = VEHICLE_MAP[normalizedId]
  if (!vehicle) notFound()
  return (
    <DriverDashboard
      vehicleId={vehicle.deviceId}
      vehicleName={vehicle.name}
      vehicleColor={vehicle.color}
    />
  )
}
