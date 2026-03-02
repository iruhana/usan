import { useRef, useEffect, useState, useCallback } from 'react'
import { Send, Mic, Monitor, FileSearch, Globe, Square, KeyRound, Volume2 } from 'lucide-react'
import { useChatStore } from '../stores/chat.store'
import { useSettingsStore } from '../stores/settings.store'
import MessageBubble from '../components/chat/MessageBubble'
import StreamingText from '../components/chat/StreamingText'
import ConversationList from '../components/chat/ConversationList'
import { SkeletonLoader } from '../components/chat/SkeletonLoader'
import { useAnnouncer } from '../components/accessibility'
import { t, getSpeechLang } from '../i18n'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return t('home.greetingMorning')
  if (hour < 18) return t('home.greetingAfternoon')
  return t('home.greetingEvening')
}

export default function HomePage() {
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const prevMessageCountRef = useRef(0)

  const conversations = useChatStore((s) => s.conversations)
  const activeConversationId = useChatStore((s) => s.activeConversationId)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const streamingText = useChatStore((s) => s.streamingText)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const stopStreaming = useChatStore((s) => s.stopStreaming)
  const loadFromDisk = useChatStore((s) => s.loadFromDisk)

  const { settings } = useSettingsStore()
  const { announce } = useAnnouncer()

  // Screen reader: announce streaming start/end
  const prevStreamingRef = useRef(false)
  useEffect(() => {
    if (isStreaming && !prevStreamingRef.current) {
      announce(t('a11y.streaming'))
    } else if (!isStreaming && prevStreamingRef.current) {
      announce(t('a11y.streamingDone'))
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming, announce])

  const quickActions = [
    {
      icon: Monitor,
      label: t('home.quickAction.screenError'),
      description: t('home.quickAction.screenErrorDesc'),
      prompt: t('home.quickAction.screenErrorPrompt'),
    },
    {
      icon: FileSearch,
      label: t('home.quickAction.findFile'),
      description: t('home.quickAction.findFileDesc'),
      prompt: t('home.quickAction.findFilePrompt'),
    },
    {
      icon: Globe,
      label: t('home.quickAction.weather'),
      description: t('home.quickAction.weatherDesc'),
      prompt: t('home.quickAction.weatherPrompt'),
    },
    {
      icon: Volume2,
      label: t('home.quickAction.readAloud'),
      description: t('home.quickAction.readAloudDesc'),
      prompt: t('home.quickAction.readAloudPrompt'),
    },
  ]

  const quickChips = quickActions.map((a) => ({ label: a.label, prompt: a.prompt }))

  const activeConversation = conversations.find((c) => c.id === activeConversationId)
  const messages = activeConversation?.messages ?? []

  // Load saved conversations on first mount
  useEffect(() => {
    loadFromDisk()
  }, [loadFromDisk])

  // Cleanup speech recognition on unmount — null the ref to prevent onend/onerror from calling setState
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      recognitionRef.current = null
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  // TTS: read assistant messages aloud
  useEffect(() => {
    if (!settings.voiceEnabled) return
    if (messages.length <= prevMessageCountRef.current) {
      prevMessageCountRef.current = messages.length
      return
    }
    prevMessageCountRef.current = messages.length

    const lastMsg = messages[messages.length - 1]
    if (lastMsg?.role === 'assistant' && !lastMsg.toolCalls?.length) {
      const utterance = new SpeechSynthesisUtterance(lastMsg.content)
      utterance.lang = getSpeechLang()
      utterance.rate = settings.voiceSpeed
      speechSynthesis.speak(utterance)
    }
  }, [messages, settings.voiceEnabled, settings.voiceSpeed])

  const handleSend = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) return
      sendMessage(text)
      setInput('')
    },
    [isStreaming, sendMessage]
  )

  // Voice input (STT) — continuous mode: keeps listening after each utterance
  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) return

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = getSpeechLang()
    recognition.interimResults = true
    recognition.continuous = true
    recognitionRef.current = recognition

    let silenceTimer: ReturnType<typeof setTimeout> | null = null

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      if (event.results[event.results.length - 1].isFinal) {
        if (transcript.trim()) handleSend(transcript.trim())
        setInput('')
        // Auto-stop after 10 seconds of silence
        if (silenceTimer) clearTimeout(silenceTimer)
        silenceTimer = setTimeout(() => {
          recognitionRef.current?.stop()
          setIsListening(false)
        }, 10000)
      } else {
        setInput(transcript)
      }
    }
    recognition.onerror = () => {
      if (!recognitionRef.current) return
      setIsListening(false)
      if (silenceTimer) clearTimeout(silenceTimer)
    }
    recognition.onend = () => {
      if (!recognitionRef.current) return
      setIsListening(false)
      if (silenceTimer) clearTimeout(silenceTimer)
    }

    setIsListening(true)
    recognition.start()
  }, [isListening, handleSend])

  const hasMessages = messages.length > 0 || isStreaming
  const hasApiKey = !!settings.cloudApiKey

  return (
    <div className="flex h-full">
      {/* Conversation list panel */}
      <ConversationList />

      <div className="flex flex-col flex-1 min-w-0">
      {/* API key missing banner */}
      {!hasApiKey && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <KeyRound size={22} className="text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-amber-800 dark:text-amber-200" style={{ fontSize: 'var(--font-size-sm)' }}>
                {t('home.apiKeyNeeded')}
              </p>
              <p className="text-amber-600 dark:text-amber-400" style={{ fontSize: 'calc(13px * var(--font-scale))' }}>
                {t('home.apiKeyHint')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-auto p-6">
        {!hasMessages ? (
          /* Welcome + Quick Actions + Recent conversations */
          <div className="flex flex-col items-center justify-center h-full gap-8">
            <div className="text-center">
              <div className="text-6xl mb-4">🤖</div>
              <h1
                className="font-bold text-[var(--color-text)] mb-2"
                style={{ fontSize: 'var(--font-size-xl)' }}
              >
                {getGreeting()}
              </h1>
              <p
                className="text-[var(--color-text-muted)]"
                style={{ fontSize: 'var(--font-size-sm)' }}
              >
                {t('home.welcomeSub')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl w-full">
              {quickActions.map((action, i) => {
                const Icon = action.icon
                return (
                  <button
                    key={i}
                    onClick={() => handleSend(action.prompt)}
                    className="flex flex-col items-start gap-3 p-6 rounded-2xl glass hover:border-[var(--color-primary)] hover:shadow-lg transition-all text-left"
                    style={{ minHeight: 'var(--min-target)' }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center">
                      <Icon size={24} className="text-[var(--color-primary)]" />
                    </div>
                    <div>
                      <div className="font-semibold" style={{ fontSize: 'var(--font-size-sm)' }}>
                        {action.label}
                      </div>
                      <div
                        className="text-[var(--color-text-muted)] mt-1"
                        style={{ fontSize: 'calc(14px * var(--font-scale))' }}
                      >
                        {action.description}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Recent conversations */}
            {conversations.length > 0 && (
              <div className="max-w-3xl w-full">
                <h2
                  className="font-semibold text-[var(--color-text-muted)] mb-3"
                  style={{ fontSize: 'var(--font-size-sm)' }}
                >
                  {t('home.recentTasks')}
                </h2>
                <div className="flex flex-col gap-2">
                  {[...conversations].sort((a, b) => {
                    const aTime = a.messages.length > 0 ? a.messages[a.messages.length - 1].timestamp : a.createdAt
                    const bTime = b.messages.length > 0 ? b.messages[b.messages.length - 1].timestamp : b.createdAt
                    return bTime - aTime
                  }).slice(0, 5).map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => useChatStore.getState().setActiveConversation(conv.id)}
                      className="flex items-center gap-3 px-5 py-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:shadow-sm transition-all text-left"
                      style={{ minHeight: 'var(--min-target)' }}
                    >
                      <span className="flex-1 truncate font-medium" style={{ fontSize: 'var(--font-size-sm)' }}>
                        {conv.title}
                      </span>
                      <span className="text-[var(--color-text-muted)] shrink-0" style={{ fontSize: 'calc(13px * var(--font-scale))' }}>
                        {conv.messages.length} {t('chat.messages')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Messages */
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isStreaming && !streamingText && <SkeletonLoader />}
            {isStreaming && streamingText && <StreamingText text={streamingText} />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Quick command chips */}
      {!isStreaming && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 pt-3 pb-0">
          <div className="max-w-3xl mx-auto flex gap-2 overflow-x-auto scrollbar-none">
            {quickChips.map((chip, i) => (
              <button
                key={i}
                onClick={() => handleSend(chip.prompt)}
                className="shrink-0 px-4 py-2 rounded-full bg-[var(--color-surface-soft)] text-[var(--color-primary)] font-medium hover:bg-[var(--color-primary-light)] transition-all"
                style={{ fontSize: 'calc(13px * var(--font-scale))', minHeight: '44px' }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {/* Voice input button */}
          <button
            onClick={toggleListening}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shrink-0 ${
              isListening
                ? 'bg-red-500 text-white'
                : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-sidebar)]'
            }`}
            aria-label={isListening ? t('home.voiceStop') : t('home.voiceStart')}
          >
            {isListening ? (
              <div className="flex items-center gap-0.5">
                <span className="voice-wave-bar" />
                <span className="voice-wave-bar" />
                <span className="voice-wave-bar" />
                <span className="voice-wave-bar" />
                <span className="voice-wave-bar" />
              </div>
            ) : (
              <Mic size={26} />
            )}
          </button>

          {/* Text input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
            placeholder={isListening ? t('home.listening') : t('home.inputPlaceholder')}
            className="flex-1 h-14 px-5 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] transition-all"
            style={{ fontSize: 'var(--font-size-sm)' }}
            disabled={isStreaming}
          />

          {/* Send / Stop button */}
          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="w-14 h-14 rounded-full bg-[var(--color-danger)] text-white flex items-center justify-center hover:bg-red-600 transition-all shrink-0"
              aria-label={t('home.stop')}
            >
              <Square size={20} />
            </button>
          ) : (
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim()}
              className="w-14 h-14 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
              aria-label={t('home.send')}
            >
              <Send size={22} />
            </button>
          )}
        </div>
      </div>
      </div>{/* end flex-col */}
    </div>
  )
}
