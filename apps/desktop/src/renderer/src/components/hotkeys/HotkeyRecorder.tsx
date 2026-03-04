import { useState } from 'react'
import { Keyboard } from 'lucide-react'
import { Button } from '../ui'

interface HotkeyRecorderProps {
  value: string
  onChange: (accelerator: string) => void
}

function toAccelerator(event: KeyboardEvent): string {
  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (event.metaKey) parts.push('Meta')

  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    parts.push(key)
  }

  return parts.join('+')
}

export default function HotkeyRecorder({ value, onChange }: HotkeyRecorderProps) {
  const [recording, setRecording] = useState(false)

  return (
    <Button
      size="sm"
      variant={recording ? 'danger' : 'secondary'}
      leftIcon={<Keyboard size={14} />}
      onClick={() => setRecording(true)}
      onKeyDown={(event) => {
        if (!recording) return
        event.preventDefault()
        const accelerator = toAccelerator(event.nativeEvent)
        if (accelerator) {
          onChange(accelerator)
        }
        setRecording(false)
      }}
    >
      {recording ? 'Press keys...' : value || 'Record hotkey'}
    </Button>
  )
}
