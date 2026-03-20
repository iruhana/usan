/**
 * Z7 Composer
 * Task input, attachments, model picker, provider bootstrap checks, send/stop.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronDown, Image, Paperclip, Send, Square, X } from 'lucide-react'
import type {
  AIModelProvider,
  ChatPayload,
  ProviderSecretStatus,
  ProviderSecretsSnapshot,
  ShellAttachment,
  ShellChatMessage,
} from '@shared/types'
import { reqId, uid, useChatStore } from '../../stores/chat.store'
import { useSettingsStore } from '../../stores/settings.store'
import { useShellStore } from '../../stores/shell.store'
import { useUiStore } from '../../stores/ui.store'
import { extractAttachmentText, shouldPersistAttachmentDataUrl } from '../../utils/attachmentText'
import AttachmentDeliveryBadge from './AttachmentDeliveryBadge'
import AttachmentTextDisclosure from './AttachmentTextDisclosure'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'AI 응답을 시작하지 못했습니다.'
}

function getProviderLabel(provider: AIModelProvider): string {
  switch (provider) {
    case 'anthropic':
      return 'Anthropic'
    case 'openai':
      return 'OpenAI'
    case 'google':
      return 'Google AI'
  }
}

function getProviderStatus(
  snapshot: ProviderSecretsSnapshot | null,
  provider: AIModelProvider | undefined,
): ProviderSecretStatus | null {
  if (!snapshot || !provider) {
    return null
  }

  return snapshot.providers.find((item) => item.provider === provider) ?? null
}

let attachmentSeq = 0

function createAttachmentId(): string {
  attachmentSeq += 1
  return `attachment-${Date.now()}-${attachmentSeq}`
}

function formatAttachmentSize(sizeBytes: number): string {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (sizeBytes >= 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`
  }

  return `${sizeBytes} B`
}

function summarizeAttachments(attachments: ShellAttachment[]): string {
  return attachments
    .map((attachment) => `- ${attachment.name} (${attachment.kind}, ${attachment.sizeLabel})`)
    .join('\n')
}

function buildMessageContent(content: string, attachments: ShellAttachment[]): string {
  const trimmedContent = content.trim()
  if (attachments.length === 0 || trimmedContent.includes('[Attachments]')) {
    return trimmedContent
  }

  const attachmentSummary = `[Attachments]\n${summarizeAttachments(attachments)}`
  return trimmedContent
    ? `${trimmedContent}\n\n${attachmentSummary}`
    : attachmentSummary
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Failed to read attachment preview'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read attachment preview'))
    reader.readAsDataURL(file)
  })
}

export default function Composer() {
  const activeSessionId = useShellStore((state) => state.activeSessionId)
  const attachments = useShellStore((state) => state.attachments)
  const appendAttachment = useShellStore((state) => state.appendAttachment)
  const removeAttachment = useShellStore((state) => state.removeAttachment)
  const commitAttachments = useShellStore((state) => state.commitAttachments)
  const toolUseEnabled = useSettingsStore((state) => state.settings.toolUseEnabled)
  const setView = useUiStore((state) => state.setView)
  const {
    models,
    selectedModel,
    setModel,
    streaming,
    streamingId,
    startStreaming,
    stopStreamingState,
    setError,
  } = useChatStore()
  const [input, setInput] = useState('')
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [secretSnapshot, setSecretSnapshot] = useState<ProviderSecretsSnapshot | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const currentModel = models.find((model) => model.id === selectedModel)
  const stagedAttachments = useMemo(() => (
    activeSessionId
      ? attachments.filter((attachment) => attachment.sessionId === activeSessionId && attachment.status === 'staged')
      : []
  ), [activeSessionId, attachments])
  const sentAttachmentsByMessageId = useMemo(() => {
    const lookup = new Map<string, ShellAttachment[]>()
    if (!activeSessionId) {
      return lookup
    }

    for (const attachment of attachments) {
      if (
        attachment.sessionId !== activeSessionId
        || attachment.status !== 'sent'
        || !attachment.messageId
      ) {
        continue
      }

      const existing = lookup.get(attachment.messageId) ?? []
      existing.push(attachment)
      lookup.set(attachment.messageId, existing)
    }

    return lookup
  }, [activeSessionId, attachments])
  const currentProviderStatus = useMemo(
    () => getProviderStatus(secretSnapshot, currentModel?.provider),
    [currentModel?.provider, secretSnapshot],
  )
  const missingProviderKey = Boolean(currentModel?.provider) && currentProviderStatus?.configured === false
  const sendDisabled = !streaming && (!activeSessionId || missingProviderKey || (!input.trim() && stagedAttachments.length === 0))

  useEffect(() => {
    let cancelled = false

    void window.usan.secrets.getStatus().then((snapshot) => {
      if (!cancelled) {
        setSecretSnapshot(snapshot)
      }
    }).catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  const stageFiles = useCallback(async (
    files: File[],
    mode: 'file' | 'image',
    source: ShellAttachment['source'],
  ) => {
    if (!activeSessionId || files.length === 0) {
      return
    }

    for (const file of files) {
      const kind = mode === 'image' || file.type.startsWith('image/')
        ? 'image'
        : 'file'
      const dataUrl = kind === 'image' || (kind === 'file' && shouldPersistAttachmentDataUrl(file))
        ? await readFileAsDataUrl(file).catch(() => undefined)
        : undefined
      const textContent = kind === 'file'
        ? await extractAttachmentText(file).catch(() => undefined)
        : undefined
      const attachment: ShellAttachment = {
        id: createAttachmentId(),
        sessionId: activeSessionId,
        kind,
        source,
        status: 'staged',
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        sizeLabel: formatAttachmentSize(file.size),
        createdAt: '방금',
        path: (file as File & { path?: string }).path,
        dataUrl,
        textContent,
      }
      await appendAttachment(attachment)
    }
  }, [activeSessionId, appendAttachment])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if ((text.length === 0 && stagedAttachments.length === 0) || streaming || !activeSessionId) {
      return
    }

    const latestSecretSnapshot = await window.usan.secrets.getStatus().catch(() => secretSnapshot)
    if (latestSecretSnapshot) {
      setSecretSnapshot(latestSecretSnapshot)
    }

    const latestProviderStatus = getProviderStatus(latestSecretSnapshot ?? secretSnapshot, currentModel?.provider)
    if (currentModel?.provider && latestProviderStatus?.configured === false) {
      setError(`${getProviderLabel(currentModel.provider)} API 키가 설정되지 않아 ${currentModel.name} 모델을 시작할 수 없습니다.`)
      return
    }

    const requestId = reqId()
    const promptContent = buildMessageContent(text, stagedAttachments)
    const transcriptContent = text || buildMessageContent('', stagedAttachments)
    const userMessage: ShellChatMessage = {
      id: uid(),
      sessionId: activeSessionId,
      role: 'user',
      content: transcriptContent,
      ts: Date.now(),
    }
    const shellStore = useShellStore.getState()
    const history: ChatPayload['messages'] = [
      ...shellStore.messages
        .filter((message) => message.sessionId === activeSessionId)
        .map((message) => ({
          role: message.role,
          content: buildMessageContent(
            message.content,
            sentAttachmentsByMessageId.get(message.id) ?? [],
          ),
          attachments: (() => {
            const messageAttachments = sentAttachmentsByMessageId.get(message.id) ?? []
            return messageAttachments.length > 0 ? messageAttachments : undefined
          })(),
        })),
      {
        role: userMessage.role,
        content: promptContent,
        attachments: stagedAttachments.length > 0 ? stagedAttachments : undefined,
      },
    ]

    startStreaming(requestId, activeSessionId)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      await window.usan.ai.chat({
        requestId,
        sessionId: activeSessionId,
        userMessage: {
          id: userMessage.id,
          content: transcriptContent,
          ts: userMessage.ts,
        },
        messages: history,
        attachments: stagedAttachments,
        model: selectedModel,
        useTools: toolUseEnabled,
      })
      await commitAttachments(activeSessionId, stagedAttachments.map((attachment) => attachment.id), userMessage.id)
    } catch (error) {
      stopStreamingState()
      setError(getErrorMessage(error))
    }
  }, [
    activeSessionId,
    currentModel,
    input,
    secretSnapshot,
    selectedModel,
    sentAttachmentsByMessageId,
    setError,
    startStreaming,
    stagedAttachments,
    commitAttachments,
    stopStreamingState,
    streaming,
    toolUseEnabled,
  ])

  const handleStop = useCallback(async () => {
    if (!streamingId) {
      return
    }

    try {
      await window.usan.ai.stop(streamingId)
    } catch (error) {
      console.error('Failed to stop AI stream', error)
    }
  }, [streamingId])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value)
    const element = event.target
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`
  }

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file instanceof File)

    if (imageFiles.length === 0) {
      return
    }

    event.preventDefault()
    void stageFiles(imageFiles, 'image', 'clipboard')
  }, [stageFiles])

  const handleInputFiles = useCallback((event: React.ChangeEvent<HTMLInputElement>, mode: 'file' | 'image') => {
    const files = Array.from(event.target.files ?? [])
    void stageFiles(files, mode, 'picker')
    event.target.value = ''
  }, [stageFiles])

  return (
    <div
      data-shell-zone="composer"
      style={{
        borderTop: '1px solid var(--border-default)',
        background: 'var(--bg-surface)',
        padding: 'var(--sp-3) var(--sp-4)',
        flexShrink: 0,
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => handleInputFiles(event, 'file')}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => handleInputFiles(event, 'image')}
      />

      {stagedAttachments.length > 0 && (
        <div
          data-composer-attachments="staged"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--sp-2)',
            marginBottom: 'var(--sp-2)',
          }}
        >
          {stagedAttachments.map((attachment) => (
            <StagedAttachmentChip
              key={attachment.id}
              attachment={attachment}
              modelId={currentModel?.id}
              onRemove={() => { void removeAttachment(attachment.id) }}
            />
          ))}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 'var(--sp-2)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--sp-2) var(--sp-3)',
          alignItems: 'flex-end',
          transition: 'border-color var(--dur-micro)',
        }}
        onFocus={(event) => { event.currentTarget.style.borderColor = 'var(--border-focus)' }}
        onBlur={(event) => { event.currentTarget.style.borderColor = 'var(--border-default)' }}
      >
        <div style={{ display: 'flex', gap: 2, paddingBottom: 2 }}>
          <ComposerButton icon={Paperclip} label="파일 첨부" onClick={() => fileInputRef.current?.click()} />
          <ComposerButton icon={Image} label="이미지 첨부" onClick={() => imageInputRef.current?.click()} />
        </div>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="무엇을 만들거나 고치고 싶은지 설명해 주세요."
          rows={1}
          aria-label="메시지 입력"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: 'var(--fs-base)',
            lineHeight: 'var(--lh-normal)',
            resize: 'none',
            minHeight: 24,
            maxHeight: 160,
            fontFamily: 'var(--font-sans)',
          }}
        />

        <div style={{ position: 'relative', paddingBottom: 2 }}>
          <button
            type="button"
            onClick={() => setShowModelPicker((open) => !open)}
            aria-label="모델 선택"
            aria-expanded={showModelPicker}
            className="focus-ring"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-1)',
              padding: '3px 8px',
              background: 'var(--bg-hover)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--fs-xs)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {currentModel && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: currentModel.color,
                  flexShrink: 0,
                }}
              />
            )}
            <span className="truncate" style={{ maxWidth: 100 }}>
              {currentModel?.name ?? 'Model'}
            </span>
            {currentProviderStatus && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: currentProviderStatus.configured ? 'var(--success)' : 'var(--danger)',
                  flexShrink: 0,
                }}
              />
            )}
            <ChevronDown size={10} />
          </button>

          {showModelPicker && (
            <div
              className="anim-scale-in"
              style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                marginBottom: 'var(--sp-1)',
                width: 220,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-3)',
                padding: 'var(--sp-1)',
                zIndex: 100,
                maxHeight: 320,
                overflowY: 'auto',
              }}
            >
              {models.map((model) => {
                const status = getProviderStatus(secretSnapshot, model.provider)
                const active = model.id === selectedModel

                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      setModel(model.id)
                      setShowModelPicker(false)
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--sp-2)',
                      padding: '6px var(--sp-2)',
                      background: active ? 'var(--bg-active)' : 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--fs-sm)',
                    }}
                    onMouseEnter={(event) => {
                      if (!active) {
                        event.currentTarget.style.background = 'var(--bg-hover)'
                      }
                    }}
                    onMouseLeave={(event) => {
                      if (!active) {
                        event.currentTarget.style.background = 'transparent'
                      }
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: model.color,
                        flexShrink: 0,
                      }}
                    />
                    <span className="truncate" style={{ flex: 1 }}>{model.name}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{model.provider}</span>
                    {status && (
                      <span
                        title={status.configured ? 'provider ready' : 'provider key missing'}
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: status.configured ? 'var(--success)' : 'var(--danger)',
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={streaming ? () => { void handleStop() } : () => { void handleSend() }}
          aria-label={streaming ? '중지' : '전송'}
          disabled={sendDisabled}
          className="focus-ring"
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: streaming
              ? 'var(--danger)'
              : sendDisabled
                ? 'var(--bg-hover)'
                : 'var(--accent)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: streaming
              ? 'var(--text-inverse)'
              : sendDisabled
                ? 'var(--text-muted)'
                : 'var(--text-inverse)',
            cursor: streaming ? 'pointer' : sendDisabled ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            transition: 'background var(--dur-micro)',
          }}
        >
          {streaming ? <Square size={14} fill="currentColor" /> : <Send size={14} />}
        </button>
      </div>

      {missingProviderKey && currentModel && (
        <div
          data-composer-provider-warning={currentModel.provider}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--sp-3)',
            marginTop: 'var(--sp-2)',
            padding: 'var(--sp-2) var(--sp-3)',
            background: 'var(--warning-soft)',
            border: '1px solid var(--warning)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', minWidth: 0 }}>
            <AlertTriangle size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-primary)' }}>
              {getProviderLabel(currentModel.provider)} 키가 없어 {currentModel.name} 모델을 바로 실행할 수 없습니다.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setView('settings')}
            className="focus-ring"
            style={{
              padding: '4px 10px',
              borderRadius: '999px',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: 'var(--fs-xs)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            설정 열기
          </button>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--sp-1) var(--sp-1) 0',
        }}
      >
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
          Enter 전송, Shift+Enter 줄바꿈, Ctrl+K 명령 팔레트, 이미지 붙여넣기 지원
        </span>
      </div>
    </div>
  )
}

function ComposerButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Paperclip
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="focus-ring"
      style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        transition: 'color var(--dur-micro)',
      }}
      onMouseEnter={(event) => { event.currentTarget.style.color = 'var(--text-primary)' }}
      onMouseLeave={(event) => { event.currentTarget.style.color = 'var(--text-muted)' }}
    >
      <Icon size={14} strokeWidth={1.5} />
    </button>
  )
}

function StagedAttachmentChip({
  attachment,
  modelId,
  onRemove,
}: {
  attachment: ShellAttachment
  modelId?: string
  onRemove: () => void
}) {
  return (
    <div
      data-composer-attachment-kind={attachment.kind}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-2)',
        maxWidth: 240,
        padding: '6px 10px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-default)',
        background: 'var(--bg-elevated)',
      }}
    >
      {attachment.dataUrl ? (
        <img
          src={attachment.dataUrl}
          alt={attachment.name}
          style={{
            width: 28,
            height: 28,
            borderRadius: 'var(--radius-sm)',
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-hover)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 'var(--fs-xs)',
            fontWeight: 700,
          }}
        >
          {attachment.kind === 'image' ? 'IMG' : 'FILE'}
        </div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="truncate" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {attachment.name}
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
          {attachment.sizeLabel}
        </div>
        <AttachmentTextDisclosure
          attachmentName={attachment.name}
          textContent={attachment.textContent}
          previewChars={120}
          scope="composer"
        />
        <div style={{ marginTop: 4 }}>
          <AttachmentDeliveryBadge
            attachment={attachment}
            modelId={modelId}
            context="composer"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${attachment.name} 첨부 제거`}
        className="focus-ring"
        style={{
          width: 22,
          height: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '999px',
          border: 'none',
          background: 'transparent',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <X size={12} />
      </button>
    </div>
  )
}
