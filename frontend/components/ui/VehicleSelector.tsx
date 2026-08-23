import { type FC } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Car, Wifi, WifiOff } from 'lucide-react'
import type { FleetVehicle } from '@/lib/types'

interface VehicleSelectorProps {
  vehicles: FleetVehicle[]
  selectedId: string | null // null = "All Vehicles"
  onChange: (id: string | null) => void
  isOpen: boolean
  onToggle: () => void
  allowAll?: boolean
}

export const VehicleSelector: FC<VehicleSelectorProps> = ({
  vehicles, selectedId, onChange, isOpen, onToggle, allowAll = true
}) => {
  const selected = selectedId ? vehicles.find(v => v.device_id === selectedId) : null

  return (
    <div className="relative">
      <button 
        onClick={onToggle}
        className="flex items-center gap-3 px-3 py-1.5 rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <Car size={14} color={selected ? selected.color : 'var(--text-secondary)'} />
        <div className="flex flex-col items-start text-left">
          <span className="text-[10px] text-[var(--text-secondary)] font-mono leading-tight">
            {selected ? selected.device_id : 'FLEET VIEW'}
          </span>
          <span className="text-xs font-semibold leading-tight">
            {selected ? selected.name : 'All Vehicles'}
          </span>
        </div>
        <ChevronDown size={14} className={`ml-2 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 w-64 rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-xl overflow-hidden z-50 backdrop-blur-xl"
          >
            {allowAll && (
              <button
                onClick={() => { onChange(null); onToggle(); }}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors ${selectedId === null ? 'bg-[var(--bg-hover)]' : ''}`}
              >
                <div className="w-2 h-2 rounded-full bg-white/20" />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold text-white">All Vehicles</span>
                  <span className="text-[10px] text-[var(--text-secondary)] font-mono">Aggregated Fleet View</span>
                </div>
              </button>
            )}
            
            <div className="max-h-64 overflow-y-auto">
              {vehicles.map(v => (
                <button
                  key={v.device_id}
                  onClick={() => { onChange(v.device_id); onToggle(); }}
                  className={`w-full flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors last:border-0 ${selectedId === v.device_id ? 'bg-[rgba(255,255,255,0.03)]' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color, boxShadow: `0 0 8px ${v.color}` }} />
                    <div className="flex flex-col items-start text-left">
                      <span className="text-sm font-semibold" style={{ color: selectedId === v.device_id ? 'white' : 'var(--text-primary)' }}>
                        {v.name}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)] font-mono">{v.device_id}</span>
                    </div>
                  </div>
                  {v.active ? <Wifi size={14} color="#2ed573" /> : <WifiOff size={14} color="var(--text-muted)" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
