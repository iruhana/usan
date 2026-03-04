import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { Send, Mic, Monitor, FileSearch, Globe, Square, KeyRound, Volume2, ArrowRight, MessageSquarePlus } from 'lucide-react'
import { useChatStore } from '../stores/chat.store'
import { useSettingsStore } from '../stores/settings.store'
import MessageBubble from '../components/chat/MessageBubble'
import StreamingText from '../components/chat/StreamingText'
import ConversationList from '../components/chat/ConversationList'
import { SkeletonLoader } from '../components/chat/SkeletonLoader'
import { useAnnouncer } from '../components/accessibility'
import { t, getSpeechLang } from '../i18n'

const quickActions = [
  { icon: Monitor, labelKey: 'home.quickAction.screenError', descKey: 'home.quickAction.screenErrorDesc', promptKey: 'home.quickAction.screenErrorPrompt' },
  { icon: FileSearch, labelKey: 'home.quickAction.findFile', descKey: 'home.quickAction.findFileDesc', promptKey: 'home.quickAction.findFilePrompt' },
  { icon: Globe, labelKey: 'home.quickAction.weather', descKey: 'home.quickAction.weatherDesc', promptKey: 'home.quickAction.weatherPrompt' },
] as const

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const conversations = useChatStore((s) => s.conversations)
  const activeConversationId = useChatStore((s) => s.activeConversationId)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const streamingPhase = useChatStore((s) => s.streamingPhase)
  const streamingText = useChatStore((s) => s.streamingText)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const stopStreaming = useChatStore((s) => s.stopStreaming)
  const loadFromDisk = useChatStore((s) => s.loadFromDisk)
  const newConversation = useChatStore((s) => s.newConversation)
  const setActiveConversation = useChatStore((s) => s.setActiveConversation)

  const { settings } = useSettingsStore()
  const { announce } = useAnnouncer()

  const prevStreamingRef = useRef(false)
  useEffect(() => {
    if (isStreaming && !prevStreamingRef.current) announce(t('a11y.streaming'))
    else if (!isStreaming && prevStreamingRef.current) announce(t('a11y.streamingDone'))
    prevStreamingRef.current = isStreaming
  }, [isStreaming, announce])

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId),
    [conversations, activeConversationId],
  )
  const messages = useMemo(() => activeConversation?.messages ?? [], [activeConversation])
  const recentConversations = useMemo(() => {
    return [...conversations]
      .sort((a, b) => {
        const aTime = a.messages.length > 0 ? a.messages[a.messages.length - 1].timestamp : a.createdAt
        const bTime = b.messages.length > 0 ? b.messages[b.messages.length - 1].timestamp : b.createdAt
        return bTime - aTime
      })
      .slice(0, 5)
  }, [conversations])

  useEffect(() => { loadFromDisk() }, [loadFromDisk])
  useEffect(() => { return () => { recognitionRef.current?.stop(); recognitionRef.current = null } }, [])

  // Stop voice recognition when window loses focus
  useEffect(() => {
    const handleBlur = () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
        setIsListening(false)
      }
    }
    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [])

  // Feed Whisper STT results into input field
  useEffect(() => {
    const unsubscribe = window.usan?.voice.onStatus((event) => {
      if (event.status === 'idle' && event.text) {
        const t = event.text
        setInput((prev) => prev ? `${prev} ${t}` : t)
      }
    })
    return () => { if (unsubscribe) unsubscribe() }
  }, [])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streamingText])

  useEffect(() => {
    if (!settings.voiceEnabled) return
    if (messages.length <= prevMessageCountRef.current) { prevMessageCountRef.current = messages.length; return }
    prevMessageCountRef.current = messages.length
    const lastMsg = messages[messages.length - 1]
    if (lastMsg?.role === 'assistant' && !lastMsg.toolCalls?.length) {
      const utterance = new SpeechSynthesisUtterance(lastMsg.content)
      utterance.lang = getSpeechLang()
      utterance.rate = settings.voiceSpeed
      speechSynthesis.speak(utterance)
    }
  }, [messages, settings.voiceEnabled, settings.voiceSpeed])

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [])

  useEffect(() => { resizeTextarea() }, [input, resizeTextarea])

  const handleSend = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return
    sendMessage(text)
    setInput('')
  }, [isStreaming, sendMessage])

  const toggleListening = useCallback(() => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return }
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
      for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript
      if (event.results[event.results.length - 1].isFinal) {
        if (transcript.trim()) handleSend(transcript.trim())
        setInput('')
        if (silenceTimer) clearTimeout(silenceTimer)
        silenceTimer = setTimeout(() => { recognitionRef.current?.stop(); setIsListening(false) }, 10000)
      } else { setInput(transcript) }
    }
    recognition.onerror = () => { if (!recognitionRef.current) return; setIsListening(false); if (silenceTimer) clearTimeout(silenceTimer) }
    recognition.onend = () => { if (!recognitionRef.current) return; setIsListening(false); if (silenceTimer) clearTimeout(silenceTimer) }
    setIsListening(true)
    recognition.start()
  }, [isListening, handleSend])

  const hasMessages = messages.length > 0 || isStreaming
  const hasApiKey = !!settings.cloudApiKey

  return (
    <div className="flex h-full">
      <ConversationList />

      <div className="flex flex-col flex-1 min-w-0">
      {/* API key banner */}
      {!hasApiKey && (
        <div className="border-b border-[var(--color-warning)]/30 bg-[var(--color-surface-soft)]">
          <div className="max-w-2xl mx-auto flex items-center gap-3 px-6 py-3">
            <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-warning)]/10 flex items-center justify-center shrink-0">
              <KeyRound size={16} className="text-[var(--color-warning)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[length:var(--text-md)] font-medium text-[var(--color-text)]">
                {t('home.apiKeyNeeded')}
              </p>
              <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                {t('home.apiKeyHint')}
              </p>
            </div>
            <ArrowRight size={16} className="text-[var(--color-text-muted)] shrink-0" />
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-auto px-6 py-8">
        {!hasMessages ? (
          <div className="flex flex-col items-center justify-center h-full gap-8 max-w-xl mx-auto animate-in">
            {/* Welcome */}
            <div className="text-center">
              <h1 className="font-semibold tracking-tight text-[length:var(--text-2xl)] text-[var(--color-text)]">
                {getGreeting()}
              </h1>
              <div className="h-1 w-12 rounded-full bg-[var(--color-primary)] mx-auto mt-3 mb-2" />
              <p className="text-[length:var(--text-md)] text-[var(--color-text-muted)] mt-2">
                {t('home.welcomeSub')}
              </p>
            </div>

            {/* Quick action cards */}
            <div className="flex flex-col gap-3 w-full">
              {quickActions.map((action, i) => {
                const Icon = action.icon
                return (
                  <button
                    key={i}
                    onClick={() => handleSend(t(action.promptKey))}
                    className="group flex items-center gap-4 p-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] hover:shadow-[var(--shadow-md)] hover:-translate-y-px transition-all text-left shadow-[var(--shadow-sm)]"
                    style={{ minHeight: '72px' }}
                  >
                    <div className="w-14 h-14 rounded-[var(--radius-lg)] bg-[var(--color-primary-light)] flex items-center justify-center shrink-0 group-hover:bg-[var(--color-primary)] group-hover:shadow-[var(--shadow-md)] transition-all">
                      <Icon size={24} className="text-[var(--color-primary)] group-hover:text-[var(--color-text-inverse)] transition-colors" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[length:var(--text-lg)] font-medium text-[var(--color-text)]">{t(action.labelKey)}</div>
                      <div className="text-[length:var(--text-md)] text-[var(--color-text-muted)]">{t(action.descKey)}</div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Recent tasks */}
            {conversations.length > 0 && (
              <div className="w-full">
                <h2 className="text-[length:var(--text-xs)] font-medium text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">
                  {t('home.recentTasks')}
                </h2>
                <div className="flex flex-col">
                  {recentConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setActiveConversation(conv.id)}
                      className="flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-soft)] transition-all text-left"
                      style={{ minHeight: '48px' }}
                      title={conv.title}
                    >
                      <span className="flex-1 truncate text-[length:var(--text-md)] text-[var(--color-text)]">{conv.title}</span>
                      <span className="text-[length:var(--text-xs)] text-[var(--color-text-muted)] shrink-0">{conv.messages.length}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-2xl mx-auto flex flex-col gap-3">
            {messages.map((msg) => (<MessageBubble key={msg.id} message={msg} />))}
            {isStreaming && !streamingText && <SkeletonLoader phase={streamingPhase === 'idle' ? 'waiting' : streamingPhase} />}
            {isStreaming && streamingText && <StreamingText text={streamingText} />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Quick chips - only when no messages */}
      {!isStreaming && !hasMessages && (
        <div className="border-t border-[var(--color-border)] px-4 pt-2 pb-0">
          <div className="max-w-2xl mx-auto">
            <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)] mb-1 uppercase tracking-wide">
              {t('home.quickSuggestions')}
            </p>
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(t(action.promptKey))}
                  className="shrink-0 px-3 py-2 rounded-full border border-[var(--color-border)] text-[length:var(--text-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-all"
                  style={{ minHeight: '48px' }}
                >
                  {t(action.labelKey)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-[var(--color-border)] p-3">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <button
            onClick={toggleListening}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
              isListening
                ? 'bg-[var(--color-danger)] text-[var(--color-text-inverse)] shadow-[var(--shadow-md)]'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]'
            }`}
            aria-label={isListening ? t('home.voiceStop') : t('home.voiceStart')}
            title={isListening ? t('home.voiceStop') : t('home.voiceStart')}
          >
            {isListening ? (
              <div className="flex items-center gap-1"><span className="voice-wave-bar" /><span className="voice-wave-bar" /><span className="voice-wave-bar" /></div>
            ) : (<Mic size={18} />)}
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              const enterToSend = useSettingsStore.getState().settings.enterToSend
              if (e.key === 'Enter' && !e.shiftKey && enterToSend) {
                e.preventDefault()
                handleSend(input)
              }
            }}
            rows={1}
            placeholder={isListening ? t('home.listening') : t('home.inputPlaceholder')}
            className="flex-1 min-h-[44px] max-h-[160px] px-4 py-2.5 rounded-2xl bg-[var(--color-surface-soft)] border border-transparent text-[length:var(--text-md)] focus:border-[var(--color-primary)] focus:bg-[var(--color-bg-card)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:outline-none transition-all resize-none leading-relaxed"
            disabled={isStreaming}
          />

          {hasMessages && !isStreaming && (
            <button
              onClick={() => newConversation()}
              className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)] transition-all shrink-0"
              aria-label={t('chat.newConversation')}
              title={t('chat.newConversation')}
            >
              <MessageSquarePlus size={18} />
            </button>
          )}

          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="w-10 h-10 rounded-full bg-[var(--color-danger)] text-[var(--color-text-inverse)] flex items-center justify-center hover:opacity-90 transition-all shrink-0 shadow-[var(--shadow-md)]"
              aria-label={t('home.stop')}
              title={t('home.stop')}
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim()}
              className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-[var(--color-text-inverse)] flex items-center justify-center hover:bg-[var(--color-primary-hover)] shadow-[0_2px_4px_rgba(99,102,241,0.15)] disabled:opacity-30 disabled:shadow-none transition-all shrink-0"
              aria-label={t('home.send')}
              title={t('home.send')}
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
