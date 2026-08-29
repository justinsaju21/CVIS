'use client'

import { useEffect, useState, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Navigation } from 'lucide-react'

// Predefined route (e.g., a mock route in Chennai)
const ROUTE: [number, number][] = [
  [12.971607, 80.219954],
  [12.971781, 80.21998],
  [12.971881, 80.219368],
  [12.971828, 80.219352],
  [12.97179, 80.219337],
  [12.971625, 80.219271],
  [12.971276, 80.219131],
  [12.970738, 80.218942],
  [12.970588, 80.21889],
  [12.970448, 80.218902],
  [12.970198, 80.218814],
  [12.969783, 80.218682],
  [12.969723, 80.218667],
  [12.969387, 80.218542],
  [12.968347, 80.218101],
  [12.968315, 80.218087],
  [12.968085, 80.217993],
  [12.968055, 80.21798],
  [12.967994, 80.21795],
  [12.967949, 80.21792],
  [12.967918, 80.217882],
  [12.967917, 80.217842],
  [12.967938, 80.217773],
  [12.96801, 80.217569],
  [12.968069, 80.217589],
  [12.968157, 80.217621],
  [12.968584, 80.217818],
  [12.969784, 80.218311],
  [12.969948, 80.218378],
  [12.970366, 80.21855],
  [12.970657, 80.218677],
  [12.970757, 80.218769],
  [12.970919, 80.218843],
  [12.971302, 80.219004],
  [12.971401, 80.219045],
  [12.971739, 80.219175],
  [12.971805, 80.219201],
  [12.971874, 80.219216],
  [12.972106, 80.219301],
  [12.972212, 80.219338],
  [12.972293, 80.219366],
  [12.972533, 80.219444],
  [12.972833, 80.219557],
  [12.973044, 80.219621],
  [12.973239, 80.21969],
  [12.973423, 80.219772],
  [12.973611, 80.219849],
  [12.973815, 80.219948],
  [12.974683, 80.220314],
  [12.974852, 80.220387],
  [12.974984, 80.220449],
  [12.97508, 80.220489],
  [12.975158, 80.220527],
  [12.975228, 80.220562],
  [12.975426, 80.220674],
  [12.975485, 80.220719],
  [12.975569, 80.220782],
  [12.975596, 80.220809],
  [12.975641, 80.220856],
  [12.975686, 80.220897],
  [12.975874, 80.22106],
  [12.975928, 80.221116],
  [12.975974, 80.221169],
  [12.97603, 80.221242],
  [12.976087, 80.221333],
  [12.976248, 80.221582],
  [12.976463, 80.221928],
  [12.97655, 80.222067],
  [12.976993, 80.222763],
  [12.977223, 80.223144],
  [12.977457, 80.223531],
  [12.978116, 80.224602],
  [12.978213, 80.224769],
  [12.978394, 80.225084],
  [12.978406, 80.225104],
  [12.978416, 80.225121],
  [12.978468, 80.225212],
  [12.978553, 80.225359],
  [12.979307, 80.226664],
  [12.980252, 80.228193],
  [12.980351, 80.228355],
  [12.980483, 80.228565],
  [12.980611, 80.228782],
  [12.980919, 80.229307],
  [12.98094, 80.229347],
  [12.980996, 80.229445],
  [12.98134, 80.23001],
  [12.981361, 80.230044],
  [12.981431, 80.230159],
  [12.98147, 80.230222],
  [12.981739, 80.230664],
  [12.981868, 80.230933],
  [12.981988, 80.231303],
  [12.982035, 80.231489],
  [12.982054, 80.231661],
  [12.982052, 80.231957],
  [12.982068, 80.232219],
  [12.981999, 80.23262],
  [12.981905, 80.232911],
  [12.981846, 80.23304],
  [12.981798, 80.233128],
  [12.981636, 80.233475],
  [12.98156, 80.23364],
  [12.981401, 80.233985],
  [12.981288, 80.23423],
  [12.981245, 80.234438],
  [12.981234, 80.234615],
  [12.981228, 80.234963],
  [12.981255, 80.235894],
  [12.981324, 80.237949],
  [12.981324, 80.238923],
  [12.981343, 80.239672],
  [12.981345, 80.239912],
  [12.981384, 80.240023],
  [12.981392, 80.240246],
  [12.981408, 80.241382],
  [12.981408, 80.241771],
  [12.981411, 80.241907],
  [12.981409, 80.242215],
  [12.9814, 80.242572],
  [12.981402, 80.242719],
  [12.981399, 80.242827],
  [12.981389, 80.243038],
  [12.981381, 80.24318],
  [12.981395, 80.243193],
  [12.981405, 80.243209],
  [12.981409, 80.243228],
  [12.981408, 80.243246],
  [12.981403, 80.243264],
  [12.981392, 80.243279],
  [12.981384, 80.243438],
  [12.981346, 80.243788],
  [12.981292, 80.244403],
  [12.981192, 80.245268],
  [12.981148, 80.245628],
  [12.981093, 80.246202],
  [12.981054, 80.246614],
  [12.981031, 80.246876],
  [12.980992, 80.247288],
  [12.980961, 80.247518],
  [12.98095, 80.247612],
  [12.980931, 80.247773],
  [12.980921, 80.24786],
  [12.980913, 80.247978],
  [12.980908, 80.248036],
  [12.980895, 80.24829],
  [12.980797, 80.249358],
  [12.980758, 80.24961],
  [12.980671, 80.250035],
  [12.980567, 80.250483],
  [12.980397, 80.251132],
  [12.980301, 80.251456],
  [12.980222, 80.251761],
  [12.980154, 80.252021],
  [12.980078, 80.252272],
  [12.980107, 80.252388],
  [12.980185, 80.252497],
  [12.980278, 80.252539],
  [12.980471, 80.252633],
  [12.981791, 80.252593],
  [12.981928, 80.252589],
  [12.981993, 80.252587],
  [12.982748, 80.252575],
  [12.982827, 80.252566],
  [12.983171, 80.252525],
  [12.983241, 80.252517],
  [12.983283, 80.252506],
  [12.984686, 80.252147],
  [12.984803, 80.252117],
  [12.984888, 80.252095],
  [12.98493, 80.252084],
  [12.986266, 80.251735],
  [12.98665, 80.25164],
  [12.987794, 80.251336],
  [12.9879, 80.25131],
  [12.988077, 80.251267],
  [12.988674, 80.251123],
  [12.98885, 80.251079],
  [12.988997, 80.251043],
  [12.98988, 80.250832],
  [12.990078, 80.250784],
  [12.990573, 80.250665],
  [12.990585, 80.250662],
  [12.990635, 80.250649],
  [12.9918, 80.250355],
  [12.991906, 80.250328],
  [12.9919, 80.250176],
  [12.991886, 80.249982],
  [12.991881, 80.249778],
  [12.99188, 80.249704],
  [12.991879, 80.249616],
  [12.991879, 80.248883],
  [12.991875, 80.248572],
  [12.991873, 80.248237],
  [12.991865, 80.247561],
  [12.991857, 80.247058],
  [12.991856, 80.246967],
  [12.991848, 80.246532],
  [12.991857, 80.245951],
  [12.991863, 80.245568],
  [12.99187, 80.245328],
  [12.99187, 80.245]
]

const startPos = ROUTE[0]
const endPos = ROUTE[ROUTE.length - 1]

// Calculate true bearing between two lat/lng points
function getBearing(start: [number, number], end: [number, number]) {
  const startLat = (start[0] * Math.PI) / 180
  const startLng = (start[1] * Math.PI) / 180
  const endLat = (end[0] * Math.PI) / 180
  const endLng = (end[1] * Math.PI) / 180
  const y = Math.sin(endLng - startLng) * Math.cos(endLat)
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng)
  const bearing = (Math.atan2(y, x) * 180) / Math.PI
  return (bearing + 360) % 360
}

const destIcon = L.divIcon({
  className: 'dest-marker',
  html: `<div style="width: 32px; height: 32px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); transform: translate(-0px, -12px);">
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="#ea4335" stroke="#bc0000" stroke-width="1">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

export default function LiveMap({ speed_kmh }: { speed_kmh: number }) {
  const [progress, setProgress] = useState(0)
  const lastTimeRef = useRef<number>(Date.now())

  // Move the vehicle along the route based on speed
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const dt = (now - lastTimeRef.current) / 1000 // seconds
      lastTimeRef.current = now

      if (speed_kmh > 0) {
        // speed_kmh / 3600 = speed in km/s
        // Let's assume total route length is ~2km. 
        // This is a fake progression for the demo. We'll increase progress (0 to 1).
        // 60km/h = 1km / minute. 
        const routeLengthKm = 2
        const speedKmS = speed_kmh / 3600
        const progressIncrement = (speedKmS * dt) / routeLengthKm

        setProgress(p => {
          let np = p + progressIncrement
          if (np >= 1) np = 0 // loop for demo purposes
          return np
        })
      }
    }, 100)

    return () => clearInterval(interval)
  }, [speed_kmh])

  // Interpolate position along polyline based on 0-1 progress
  const getInterpolatedPosition = (p: number): { pos: [number, number]; bearing: number } => {
    if (p <= 0) return { pos: ROUTE[0], bearing: getBearing(ROUTE[0], ROUTE[1]) }
    if (p >= 1) return { pos: ROUTE[ROUTE.length - 1], bearing: getBearing(ROUTE[ROUTE.length - 2], ROUTE[ROUTE.length - 1]) }

    const numSegments = ROUTE.length - 1
    const currentDist = p * numSegments
    const segmentIndex = Math.floor(currentDist)
    const segmentProgress = currentDist - segmentIndex

    if (segmentIndex >= numSegments) return { pos: ROUTE[ROUTE.length - 1], bearing: 0 }

    const p1 = ROUTE[segmentIndex]
    const p2 = ROUTE[segmentIndex + 1]

    const pos: [number, number] = [
      p1[0] + (p2[0] - p1[0]) * segmentProgress,
      p1[1] + (p2[1] - p1[1]) * segmentProgress
    ]
    const bearing = getBearing(p1, p2)
    return { pos, bearing }
  }

  const { pos: currentPos, bearing } = getInterpolatedPosition(progress)

  // Dynamic values
  const totalDistanceKm = 8.4
  const remainingKm = totalDistanceKm * (1 - progress)
  const etaMinutes = speed_kmh > 0 ? (remainingKm / speed_kmh) * 60 : 0
  const etaDate = new Date(Date.now() + etaMinutes * 60000)
  const etaTime = speed_kmh > 0 ? etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'

  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: startPos,
      zoom: 16,
      zoomControl: false,
      scrollWheelZoom: true
    })
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map)

    // Solid blue route line like Google Maps
    L.polyline(ROUTE as [number, number][], { color: '#2563eb', weight: 6, opacity: 0.9 }).addTo(map)
    L.marker(endPos, { icon: destIcon }).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    
    const iconObj = L.divIcon({
      className: 'nav-arrow-marker',
      html: `<div style="width: 28px; height: 28px; transform: rotate(${bearing}deg); filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3)); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);">
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="#3b82f6" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round">
          <path d="M12 2L3 21l9-4 9 4L12 2z" />
        </svg>
      </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })

    if (!markerRef.current) {
      markerRef.current = L.marker(currentPos, { icon: iconObj }).addTo(mapRef.current)
    } else {
      markerRef.current.setLatLng(currentPos)
      markerRef.current.setIcon(iconObj)
    }
    
    // Offset the pan center by 40px downwards so the vehicle icon appears higher up (above the bottom sheet)
    const targetPoint = mapRef.current.project(currentPos)
    targetPoint.y -= 40 
    const offsetPos = mapRef.current.unproject(targetPoint)
    
    mapRef.current.panTo(offsetPos, { animate: true, duration: 0.5 })
  }, [currentPos, bearing])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1, fontFamily: 'sans-serif' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Floating Speed Limit Sign */}
      <div style={{ position: 'absolute', bottom: 90, left: 16, zIndex: 1000 }}>
        <div style={{ background: '#ffffff', borderRadius: 4, border: '3px solid #ef4444', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: '#000', lineHeight: 1, marginTop: 2 }}>MAX</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#000', lineHeight: 1, marginTop: 1 }}>60</span>
        </div>
      </div>

      {/* Unified Google Maps style bottom panel */}
      <div style={{ 
        position: 'absolute', bottom: 12, left: 12, right: 12, 
        background: '#ffffff', padding: '14px 16px', borderRadius: 16, 
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1000, 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' 
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: '#16a34a', letterSpacing: '-0.02em' }}>
              {etaMinutes > 0 ? `${Math.ceil(etaMinutes)} min` : 'Arrived'}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)', fontWeight: 500, marginTop: 2 }}>
            {remainingKm.toFixed(1)} km • {etaTime}
          </div>
        </div>
        
        {speed_kmh === 0 && (
          <div style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 20, border: '1px solid rgba(239,68,68,0.2)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', letterSpacing: '0.05em' }}>STOPPED</span>
          </div>
        )}
      </div>
    </div>
  )
}

