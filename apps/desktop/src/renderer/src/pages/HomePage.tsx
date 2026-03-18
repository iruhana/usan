import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { CloudSun, FileSearch, Plus, ScanSearch, Volume2 } from 'lucide-react'
import { useChatStore } from '../stores/chat.store'
import { useSettingsStore } from '../stores/settings.store'
import { useAnnouncer } from '../components/accessibility'
import { t, getSpeechLang } from '../i18n'
import { useVoiceStore } from '../stores/voice.store'
import { Composer, buildComposerPrompt, type ComposerSubmitPayload } from '../components/composer'
import { Timeline } from '../components/agent'
import { ArtifactShelf, ArtifactView, deriveArtifactsFromMessages } from '../components/artifact'
import ConversationList from '../components/chat/ConversationList'
import { Badge, Button, Card, PageIntro, SectionHeader } from '../components/ui'

interface QuickLaunchItem {
  id: string
  title: string
  description: string
  prompt: string
  icon: typeof ScanSearch
}

type VoiceCommandResult = { text?: string; error?: string } | undefined

function buildQuickLaunchItems(): QuickLaunchItem[] {
  return [
    {
      id: 'screen-error',
      title: t('home.quickAction.screenError'),
      description: t('home.quickAction.screenErrorDescSimple'),
      prompt: t('home.quickAction.screenErrorPrompt'),
      icon: ScanSearch,
    },
    {
      id: 'find-file',
      title: t('home.quickAction.findFile'),
      description: t('home.quickAction.findFileDescSimple'),
      prompt: t('home.quickAction.findFilePrompt'),
      icon: FileSearch,
    },
    {
      id: 'weather',
      title: t('home.quickAction.weather'),
      description: t('home.quickAction.weatherDescSimple'),
      prompt: t('home.quickAction.weatherPrompt'),
      icon: CloudSun,
    },
    {
      id: 'read-aloud',
      title: t('home.quickAction.readAloud'),
      description: t('home.quickAction.readAloudDesc'),
      prompt: t('home.quickAction.readAloudPrompt'),
      icon: Volume2,
    },
  ]
}

function createVoiceErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : 'Voice input had a problem.'
}

function canUseBrowserSpeechRecognition(): boolean {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export default function HomePage() {
  const [input, setInput] = useState('')
  const [browserListening, setBrowserListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const browserRecognitionRef = useRef<SpeechRecognition | null>(null)
  const prevMessageCountRef = useRef(0)
  const handledVoiceEventRef = useRef(0)
  const listeningBaseRef = useRef('')
  const voiceRequestRef = useRef<Promise<void> | null>(null)

  const conversations = useChatStore((s) => s.conversations)
  const activeConversationId = useChatStore((s) => s.activeConversationId)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const streamingPhase = useChatStore((s) => s.streamingPhase)
  const streamingText = useChatStore((s) => s.streamingText)
  const activeToolName = useChatStore((s) => s.activeToolName)
  const newConversation = useChatStore((s) => s.newConversation)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const retryLastMessage = useChatStore((s) => s.retryLastMessage)
  const stopStreaming = useChatStore((s) => s.stopStreaming)
  const loadFromDisk = useChatStore((s) => s.loadFromDisk)

  const { settings } = useSettingsStore()
  const voiceStatus = useVoiceStore((s) => s.status)
  const voiceEventVersion = useVoiceStore((s) => s.eventVersion)
  const { announce } = useAnnouncer()
  const applyVoiceError = useVoiceStore((s) => s.setError)

  const prevStreamingRef = useRef(false)
  useEffect(() => {
    if (isStreaming && !prevStreamingRef.current) announce(t('a11y.streaming'))
    else if (!isStreaming && prevStreamingRef.current) announce(t('a11y.streamingDone'))
    prevStreamingRef.current = isStreaming
  }, [isStreaming, announce])

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId),
    [conversations, activeConversationId],
  )
  const messages = useMemo(() => activeConversation?.messages ?? [], [activeConversation])
  const completedConversationCount = useMemo(
    () => conversations.filter((conversation) => conversation.messages.length > 0).length,
    [conversations],
  )
  const artifacts = useMemo(
    () =>
      deriveArtifactsFromMessages(messages, {
        streamingText,
        activeToolName,
      }),
    [activeToolName, messages, streamingText],
  )
  const quickLaunchItems = buildQuickLaunchItems()
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null)
  const selectedArtifact = useMemo(
    () => artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? artifacts[0] ?? null,
    [artifacts, selectedArtifactId],
  )

  useEffect(() => {
    loadFromDisk()
  }, [loadFromDisk])

  useEffect(() => {
    return () => {
      browserRecognitionRef.current?.stop()
      browserRecognitionRef.current = null
    }
  }, [])

  useEffect(() => {
    const handleBlur = () => {
      if (browserRecognitionRef.current) {
        browserRecognitionRef.current.stop()
        browserRecognitionRef.current = null
        setBrowserListening(false)
      }

      if (voiceStatus.status === 'listening') {
        void window.usan?.voice.listenStop()
      }
    }

    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [voiceStatus.status])

  const appendVoiceText = useCallback((nextText: string) => {
    const normalized = nextText.trim()
    if (!normalized) return

    setInput((prev) => (prev ? `${prev} ${normalized}` : normalized))
  }, [])

  useEffect(() => {
    if (voiceEventVersion === 0 || handledVoiceEventRef.current === voiceEventVersion) {
      return
    }
    handledVoiceEventRef.current = voiceEventVersion

    if (voiceStatus.status === 'idle' && voiceStatus.text?.trim()) {
      appendVoiceText(voiceStatus.text)
    }
  }, [appendVoiceText, voiceEventVersion, voiceStatus])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, streamingText, isStreaming])

  useEffect(() => {
    if (!artifacts.length) {
      if (selectedArtifactId !== null) {
        setSelectedArtifactId(null)
      }
      return
    }

    if (!selectedArtifactId || !artifacts.some((artifact) => artifact.id === selectedArtifactId)) {
      setSelectedArtifactId(artifacts[0]?.id ?? null)
    }
  }, [artifacts, selectedArtifactId])

  useEffect(() => {
    if (!settings.voiceEnabled) return
    if (messages.length <= prevMessageCountRef.current) {
      prevMessageCountRef.current = messages.length
      return
    }
    prevMessageCountRef.current = messages.length

    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === 'assistant' && !lastMessage.toolCalls?.length) {
      const utterance = new SpeechSynthesisUtterance(lastMessage.content)
      utterance.lang = getSpeechLang()
      utterance.rate = settings.voiceSpeed
      speechSynthesis.speak(utterance)
    }
  }, [messages, settings.voiceEnabled, settings.voiceSpeed])

  const handleComposerSubmit = useCallback(
    async (payload: ComposerSubmitPayload) => {
      if (isStreaming) return
      await sendMessage(buildComposerPrompt(payload))
    },
    [isStreaming, sendMessage],
  )

  const handleQuickLaunch = useCallback(
    async (prompt: string) => {
      if (isStreaming) return
      setInput('')
      newConversation()
      await sendMessage(prompt)
    },
    [isStreaming, newConversation, sendMessage],
  )

  const startBrowserSpeechRecognition = useCallback(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) {
      applyVoiceError('Voice input is not ready on this computer.')
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = getSpeechLang()
    recognition.interimResults = true
    recognition.continuous = true
    browserRecognitionRef.current = recognition
    listeningBaseRef.current = input.trim()

    let silenceTimer: ReturnType<typeof setTimeout> | null = null

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript
      }

      const normalized = transcript.trim()
      const withBase = normalized
        ? listeningBaseRef.current
          ? `${listeningBaseRef.current} ${normalized}`
          : normalized
        : listeningBaseRef.current

      if (event.results[event.results.length - 1].isFinal) {
        setInput(withBase)
        if (silenceTimer) clearTimeout(silenceTimer)
        silenceTimer = setTimeout(() => {
          browserRecognitionRef.current?.stop()
          browserRecognitionRef.current = null
          setBrowserListening(false)
        }, 10000)
      } else {
        setInput(withBase)
      }
    }

    recognition.onerror = () => {
      if (!browserRecognitionRef.current) return
      browserRecognitionRef.current = null
      setBrowserListening(false)
      if (silenceTimer) clearTimeout(silenceTimer)
    }

    recognition.onend = () => {
      browserRecognitionRef.current = null
      setBrowserListening(false)
      if (silenceTimer) clearTimeout(silenceTimer)
    }

    setBrowserListening(true)
    recognition.start()
  }, [applyVoiceError, input])

  const stopComposerVoice = useCallback(async () => {
    if (browserRecognitionRef.current) {
      browserRecognitionRef.current.stop()
      browserRecognitionRef.current = null
      setBrowserListening(false)
      return
    }

    if (voiceStatus.status === 'listening' || voiceStatus.status === 'processing') {
      try {
        const result = await window.usan?.voice.listenStop() as VoiceCommandResult
        if (result?.error) applyVoiceError(result.error)
      } catch (error) {
        applyVoiceError(createVoiceErrorMessage(error))
      }
    }
  }, [applyVoiceError, voiceStatus.status])

  const toggleListening = useCallback(() => {
    if (browserRecognitionRef.current || voiceStatus.status === 'listening' || voiceStatus.status === 'processing') {
      void stopComposerVoice()
      return
    }

    if (!window.usan?.voice.listenStart) {
      startBrowserSpeechRecognition()
      return
    }

    const request = Promise.resolve(window.usan.voice.listenStart() as Promise<VoiceCommandResult>)
      .then((result) => {
        if (!result?.error) return
        if (canUseBrowserSpeechRecognition()) {
          startBrowserSpeechRecognition()
          return
        }
        applyVoiceError(result.error)
      })
      .catch((error) => {
        if (canUseBrowserSpeechRecognition()) {
          startBrowserSpeechRecognition()
          return
        }
        applyVoiceError(createVoiceErrorMessage(error))
      })
      .finally(() => {
        if (voiceRequestRef.current === request) {
          voiceRequestRef.current = null
        }
      })

    voiceRequestRef.current = request
  }, [applyVoiceError, startBrowserSpeechRecognition, stopComposerVoice, voiceStatus.status])

  const isListening = browserListening || voiceStatus.status === 'listening' || voiceStatus.status === 'processing'

  const currentConversationLabel = activeConversation?.title || t('home.welcome')
  const hasHistory = completedConversationCount > 0
  const hasTimelineActivity = messages.length > 0 || isStreaming

  return (
    <div className="flex h-full min-w-0 flex-col bg-[var(--color-bg)]" data-testid="home-page">
      <div className="flex-1 overflow-hidden px-4 pb-4 pt-5 md:px-5 md:pb-5">
        <div className="mx-auto flex h-full w-full max-w-[1480px] flex-col gap-4">
          <PageIntro
            title={currentConversationLabel}
            description={
              activeConversation
                ? `${messages.length} ${t('chat.messages')} · ${t('chat.resumeHint')}`
                : t('home.welcomeSub')
            }
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => newConversation()}
                data-testid="home-new-task-button"
              >
                {t('chat.newChat')}
              </Button>
            }
          />

          <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]" data-testid="home-main-grid">
            <div className="flex min-h-0 flex-col gap-4" data-testid="home-timeline-pane">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={isStreaming ? 'info' : hasTimelineActivity ? 'success' : 'default'}>
                  {isStreaming ? t('agent.status.running') : hasTimelineActivity ? t('agent.status.completed') : t('agent.status.pending')}
                </Badge>
                <Badge variant="default">{`${completedConversationCount} ${t('chat.conversations')}`}</Badge>
                {activeToolName ? <Badge variant="info">{activeToolName}</Badge> : null}
              </div>

              <div className="min-h-0 flex-1 overflow-auto pr-1">
                <Timeline
                  messages={messages}
                  isStreaming={isStreaming}
                  streamingPhase={streamingPhase}
                  streamingText={streamingText}
                  activeToolName={activeToolName}
                  onRetry={retryLastMessage}
                  className="min-h-full"
                />
                <div ref={messagesEndRef} />
              </div>

              <Card
                variant="default"
                padding="md"
                className="shrink-0"
                data-testid="home-artifact-workspace"
              >
                <ArtifactShelf
                  artifacts={artifacts}
                  selectedArtifactId={selectedArtifact?.id ?? null}
                  onSelectArtifact={setSelectedArtifactId}
                />
                <ArtifactView artifact={selectedArtifact} className="mt-4" />
              </Card>
            </div>

            <aside className="flex min-h-0 flex-col gap-4" data-testid="home-side-panel">
              <Card variant="elevated" padding="md" data-testid="home-quick-launch">
                <SectionHeader title={t('home.quickLaunchTitle')} />
                <p className="mb-4 text-[13px] leading-6 text-[var(--color-text-secondary)]">
                  {t('home.quickLaunchBody')}
                </p>

                <div className="grid gap-2">
                  {quickLaunchItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void handleQuickLaunch(item.prompt)}
                        className="group rounded-[18px] bg-[var(--color-panel-muted)] px-4 py-3 text-left transition-all hover:bg-[var(--color-surface-soft)] hover:shadow-[var(--shadow-xs)]"
                        data-testid={`home-quick-action-${item.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[var(--color-panel-bg-strong)] text-[var(--color-primary)]">
                            <Icon size={17} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[14px] font-semibold text-[var(--color-text)]">
                              {item.title}
                            </span>
                            <span className="mt-1 block text-[12px] leading-5 text-[var(--color-text-secondary)]">
                              {item.description}
                            </span>
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </Card>

              <Card
                variant="default"
                padding="md"
                className="min-h-[280px] flex-1 overflow-hidden"
                data-testid="home-recent-work"
              >
                <ConversationList className="h-full" />
                {!hasHistory ? (
                  <p className="mt-4 text-[12px] leading-5 text-[var(--color-text-muted)]">
                    {t('chat.resumeHint')}
                  </p>
                ) : null}
              </Card>
            </aside>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--color-border-subtle)] px-4 pb-4 pt-3 md:px-5 md:pb-5">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col items-center">
          <Composer
            value={input}
            onValueChange={setInput}
            onSubmit={handleComposerSubmit}
            onStop={stopStreaming}
            onToggleVoice={toggleListening}
            isStreaming={isStreaming}
            isListening={isListening}
          />
        </div>
      </div>
    </div>
  )
}
