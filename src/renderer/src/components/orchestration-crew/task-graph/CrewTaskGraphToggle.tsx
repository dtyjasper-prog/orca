import { List, Network } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { IconButton } from '../CrewRowView'

/** Switches the crew panel between its rows and the coordinator's task graph. */
export function CrewTaskGraphToggle({
  showGraph,
  onToggle
}: {
  showGraph: boolean
  onToggle: () => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <IconButton
      label={
        showGraph
          ? t('components.orchestrationCrew.showList', 'Show as list')
          : t('components.orchestrationCrew.showGraph', 'Show task graph')
      }
      aria-pressed={showGraph}
      onClick={onToggle}
    >
      {showGraph ? <List /> : <Network />}
    </IconButton>
  )
}
