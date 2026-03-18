import { useEffect, useState } from 'react'
import { Circle, Square, RefreshCw } from 'lucide-react'
import { Card, Button, InlineNotice, Input, SectionHeader } from '../ui'
import MacroList from './MacroList'
import { t } from '../../i18n'
import { useMacroStore } from '../../stores/macro.store'

export default function MacroPanel() {
  const { items, recording, loading, error, initialize, load, startRecording, stopRecording, play, remove } = useMacroStore()
  const [newName, setNewName] = useState('Quick Macro')

  useEffect(() => {
    initialize()
    load().catch(() => {})
  }, [initialize, load])

  return (
    <Card variant="outline" className="space-y-3">
      <SectionHeader
        title={t('macro.title')}
        indicator="var(--color-primary)"
        action={(
          <Button size="sm" variant="ghost" onClick={() => load()} leftIcon={<RefreshCw size={14} />}>
            {t('dashboard.refresh')}
          </Button>
        )}
      />

      {error ? (
        <InlineNotice tone="error" title={t('macro.helpTitle')}>
          {error}
        </InlineNotice>
      ) : null}

      <Input
        value={newName}
        onChange={(event) => setNewName(event.target.value)}
        label={t('macro.name')}
        placeholder={t('macro.namePlaceholder')}
      />

      <div className="flex flex-wrap gap-2">
        {!recording ? (
          <Button size="sm" leftIcon={<Circle size={14} />} onClick={() => startRecording()}>
            {t('macro.recordStart')}
          </Button>
        ) : (
          <Button size="sm" variant="danger" leftIcon={<Square size={14} />} onClick={() => stopRecording(newName)}>
            {t('macro.recordStop')}
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('files.loading')}</p>
      ) : (
        <MacroList
          items={items}
          onPlay={(id) => play(id)}
          onDelete={(id) => remove(id)}
        />
      )}
    </Card>
  )
}
