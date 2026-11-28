import { CATEGORY_INFO, type ReportCategory } from '../../lib/reports/types'
import { CATEGORY_ICONS } from './categoryIcons'

/** Decorative category icon; the label next to it carries the meaning. */
export function CategoryIcon({ category, size = 18 }: { category: ReportCategory; size?: number }) {
  const Icon = CATEGORY_ICONS[category]
  return <Icon size={size} aria-hidden="true" focusable="false" className="icon" />
}

/** Icon plus visible category label, optionally with the Filipino name. */
export function CategoryLabel({
  category,
  showFilipino = false,
  size,
}: {
  category: ReportCategory
  showFilipino?: boolean
  size?: number
}) {
  const info = CATEGORY_INFO[category]
  return (
    <span className="with-icon">
      <CategoryIcon category={category} size={size} />
      <span>
        {info.label}
        {showFilipino && <small className="muted"> / {info.filipino}</small>}
      </span>
    </span>
  )
}
