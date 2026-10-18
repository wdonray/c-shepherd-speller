import { Badge } from '@/components/ui/badge'

/**
 * Marks prebuilt curriculum content (issue #463). Teacher-owned lists carry
 * no badge; they are the default. The badge is the visual distinction
 * between the prebuilt library and the teacher's own lists.
 */
export default function PrebuiltBadge() {
  return <Badge variant="secondary">Prebuilt</Badge>
}
