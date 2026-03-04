import { Search } from 'lucide-react'
import { Input } from '../ui'
import { t } from '../../i18n'

interface ClipboardSearchProps {
  query: string
  onQueryChange: (query: string) => void
}

export default function ClipboardSearch({ query, onQueryChange }: ClipboardSearchProps) {
  return (
    <Input
      value={query}
      onChange={(event) => onQueryChange(event.target.value)}
      placeholder={t('clipboard.searchPlaceholder')}
      leftIcon={<Search size={14} />}
      aria-label={t('clipboard.search')}
    />
  )
}
