import {
  Ambulance,
  Construction,
  Flame,
  Lightbulb,
  MapPin,
  Siren,
  Trash2,
  Waves,
  type LucideIcon,
} from 'lucide-react'
import type { ReportCategory } from '../../lib/reports/types'

/** One lucide icon per report category (no emojis in the UI). */
export const CATEGORY_ICONS: Record<ReportCategory, LucideIcon> = {
  fire: Flame,
  flood: Waves,
  medical: Ambulance,
  crime: Siren,
  road: Construction,
  utilities: Lightbulb,
  waste: Trash2,
  other: MapPin,
}
