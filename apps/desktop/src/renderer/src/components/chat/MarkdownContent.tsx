import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownContentProps {
  content: string
}

export default function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        h1: ({ children }) => <h1 className="text-[length:var(--text-lg)] font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-[length:var(--text-md)] font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-[length:var(--text-md)] font-semibold mb-1 mt-2 first:mt-0">{children}</h3>,
        ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ className, children }) => {
          const isBlock = className?.includes('language-')
          if (isBlock) {
            return (
              <code className="block bg-[var(--color-surface-soft)] border border-[var(--color-border)]/50 rounded-[var(--radius-md)] px-3 py-2 text-[length:var(--text-sm)] font-mono overflow-x-auto whitespace-pre my-2">
                {children}
              </code>
            )
          }
          return (
            <code className="bg-[var(--color-surface-soft)] border border-[var(--color-border)]/50 rounded px-1.5 py-0.5 text-[length:var(--text-sm)] font-mono">
              {children}
            </code>
          )
        },
        pre: ({ children }) => <pre className="overflow-x-auto my-2">{children}</pre>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] underline hover:opacity-80">
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-3 border-[var(--color-primary)]/40 pl-3 my-2 text-[var(--color-text-muted)] italic">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="w-full border-collapse text-[length:var(--text-sm)]">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-2 py-1 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-[var(--color-border)] px-2 py-1">{children}</td>
        ),
        hr: () => <hr className="border-[var(--color-border)] my-3" />,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
