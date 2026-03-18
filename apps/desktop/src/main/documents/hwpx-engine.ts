/**
 * HWPX Engine — Read Hancom HWPX documents
 * HWPX is a ZIP container with XML content (KS X 6101 / OWPML).
 */

interface ZipEntryLike {
  entryName: string
  getData(): Buffer
}

interface ZipArchiveLike {
  getEntries(): ZipEntryLike[]
  readAsText(entryName: string, encoding?: BufferEncoding): string
}

let AdmZipClass: (new (input?: Buffer | string) => ZipArchiveLike) | null = null
let XMLParserClass: typeof import('fast-xml-parser').XMLParser | null = null

const MAX_HWPX_ENTRIES = 512
const MAX_HWPX_SECTION_COUNT = 128
const MAX_HWPX_XML_ENTRY_BYTES = 4 * 1024 * 1024
const MAX_HWPX_TOTAL_XML_BYTES = 32 * 1024 * 1024

async function getAdmZip() {
  if (!AdmZipClass) {
    const mod = await import('adm-zip')
    AdmZipClass = (mod.default ?? mod) as new (input?: Buffer | string) => ZipArchiveLike
  }
  return AdmZipClass
}

async function createXmlParser() {
  if (!XMLParserClass) {
    const mod = await import('fast-xml-parser')
    XMLParserClass = mod.XMLParser
  }

  return new XMLParserClass({
    ignoreAttributes: false,
    removeNSPrefix: true,
    trimValues: false,
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: true,
  })
}

async function createOrderedXmlParser() {
  if (!XMLParserClass) {
    const mod = await import('fast-xml-parser')
    XMLParserClass = mod.XMLParser
  }

  return new XMLParserClass({
    ignoreAttributes: false,
    removeNSPrefix: true,
    trimValues: false,
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: true,
    preserveOrder: true,
  })
}

export interface HwpxSection {
  path: string
  text: string
  paragraphCount: number
}

export interface HwpxReadResult {
  text: string
  sectionCount: number
  paragraphCount: number
  sections: HwpxSection[]
  metadata: {
    title?: string
    subject?: string
    creator?: string
    language?: string
    manifestEntries: string[]
  }
}

export async function readHwpx(filePath: string): Promise<HwpxReadResult> {
  const AdmZip = await getAdmZip()
  const parser = await createXmlParser()
  const orderedParser = await createOrderedXmlParser()
  const zip = new AdmZip(filePath)
  const entries = zip.getEntries()

  if (entries.length > MAX_HWPX_ENTRIES) {
    throw new Error(`Invalid HWPX file: too many archive entries (${entries.length}).`)
  }

  const sectionEntries = entries
    .filter((entry) => /^Contents\/section\d+\.xml$/i.test(entry.entryName))
    .sort((a, b) => getSectionIndex(a.entryName) - getSectionIndex(b.entryName))

  if (sectionEntries.length === 0) {
    throw new Error('Invalid HWPX file: no section XML files found.')
  }
  if (sectionEntries.length > MAX_HWPX_SECTION_COUNT) {
    throw new Error(`Invalid HWPX file: too many section XML files (${sectionEntries.length}).`)
  }

  let totalXmlBytes = 0

  const sections: HwpxSection[] = sectionEntries.map((entry) => {
    const xml = readZipXmlEntry(entry, { totalXmlBytes })
    totalXmlBytes += Buffer.byteLength(xml, 'utf8')
    if (totalXmlBytes > MAX_HWPX_TOTAL_XML_BYTES) {
      throw new Error(`Invalid HWPX file: XML payload too large (${totalXmlBytes} bytes).`)
    }
    const parsed = orderedParser.parse(xml)
    const paragraphs = extractOrderedParagraphs(parsed)
    return {
      path: entry.entryName,
      text: paragraphs.join('\n\n'),
      paragraphCount: paragraphs.length,
    }
  })

  const metadata = {
    title: undefined as string | undefined,
    subject: undefined as string | undefined,
    creator: undefined as string | undefined,
    language: undefined as string | undefined,
    manifestEntries: [] as string[],
  }

  const headerEntry = entries.find((entry) => /^Contents\/header\.xml$/i.test(entry.entryName))
  if (headerEntry) {
    const xml = readZipXmlEntry(headerEntry, { totalXmlBytes })
    totalXmlBytes += Buffer.byteLength(xml, 'utf8')
    if (totalXmlBytes > MAX_HWPX_TOTAL_XML_BYTES) {
      throw new Error(`Invalid HWPX file: XML payload too large (${totalXmlBytes} bytes).`)
    }
    const header = parser.parse(xml)
    metadata.title = findFirstStringForKeys(header, ['title'])
    metadata.subject = findFirstStringForKeys(header, ['subject', 'description'])
    metadata.creator = findFirstStringForKeys(header, ['creator', 'author'])
    metadata.language = findFirstStringForKeys(header, ['language', 'lang'])
  }

  const manifestEntry = entries.find((entry) => /^META-INF\/manifest\.xml$/i.test(entry.entryName))
  if (manifestEntry) {
    const xml = readZipXmlEntry(manifestEntry, { totalXmlBytes })
    totalXmlBytes += Buffer.byteLength(xml, 'utf8')
    if (totalXmlBytes > MAX_HWPX_TOTAL_XML_BYTES) {
      throw new Error(`Invalid HWPX file: XML payload too large (${totalXmlBytes} bytes).`)
    }
    const manifest = parser.parse(xml)
    metadata.manifestEntries = extractManifestEntries(manifest)
  }

  const text = sections
    .map((section) => section.text.trim())
    .filter(Boolean)
    .join('\n\n')

  return {
    text,
    sectionCount: sections.length,
    paragraphCount: sections.reduce((sum, section) => sum + section.paragraphCount, 0),
    sections,
    metadata,
  }
}

function readZipXmlEntry(entry: ZipEntryLike, state: { totalXmlBytes: number }): string {
  const data = entry.getData()
  if (data.byteLength > MAX_HWPX_XML_ENTRY_BYTES) {
    throw new Error(`Invalid HWPX file: XML entry too large (${entry.entryName}).`)
  }

  if (state.totalXmlBytes + data.byteLength > MAX_HWPX_TOTAL_XML_BYTES) {
    throw new Error(`Invalid HWPX file: XML payload too large (${state.totalXmlBytes + data.byteLength} bytes).`)
  }

  return data.toString('utf8')
}

export async function hwpxToText(filePath: string): Promise<string> {
  const result = await readHwpx(filePath)
  return result.text
}

function getSectionIndex(entryName: string): number {
  const match = entryName.match(/section(\d+)\.xml$/i)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

function extractOrderedParagraphs(root: unknown): string[] {
  const paragraphs: string[] = []
  collectOrderedParagraphs(root, paragraphs)
  return paragraphs
}

function collectOrderedParagraphs(node: unknown, paragraphs: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectOrderedParagraphs(item, paragraphs)
    }
    return
  }

  if (!isRecord(node)) {
    return
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === '#text' || key === ':@' || isAttributeKey(key)) {
      continue
    }

    if (key === 'p') {
      const text = normalizeExtractedText(extractOrderedText(value))
      if (text) {
        paragraphs.push(text)
      }
      continue
    }

    collectOrderedParagraphs(value, paragraphs)
  }
}

function extractOrderedText(node: unknown): string {
  const tokens: string[] = []
  collectOrderedTextTokens(node, tokens)
  return tokens.join('')
}

function collectOrderedTextTokens(node: unknown, tokens: string[]): void {
  if (node == null) {
    return
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectOrderedTextTokens(item, tokens)
    }
    return
  }

  if (!isRecord(node)) {
    return
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === '#text' || key === ':@' || isAttributeKey(key)) {
      continue
    }

    if (key === 't') {
      const text = readOrderedLeafText(value)
      if (text) {
        tokens.push(text)
      }
      continue
    }

    if (key === 'lineBreak' || key === 'br') {
      tokens.push('\n')
      continue
    }

    if (key === 'tab') {
      tokens.push('\t')
      continue
    }

    collectOrderedTextTokens(value, tokens)
  }
}

function extractManifestEntries(root: unknown): string[] {
  const results: string[] = []
  collectManifestEntries(root, results)
  return Array.from(new Set(results))
}

function collectManifestEntries(node: unknown, entries: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectManifestEntries(item, entries)
    }
    return
  }

  if (!isRecord(node)) {
    return
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'item' || key === 'file-entry') {
      for (const item of toArray(value)) {
        if (!isRecord(item)) {
          continue
        }
        const candidate = [
          item['full-path'],
          item['href'],
          item['manifest:full-path'],
          item['@_full-path'],
          item['@_href'],
          item['@_manifest:full-path'],
        ]
          .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
          .find(Boolean)
        if (candidate) {
          entries.push(candidate)
        }
      }
    }

    if (!isAttributeKey(key)) {
      collectManifestEntries(value, entries)
    }
  }
}

function findFirstStringForKeys(node: unknown, keys: string[]): string | undefined {
  const candidates = new Set(keys.map((key) => key.toLowerCase()))
  return findFirstStringForKeysInternal(node, candidates)
}

function findFirstStringForKeysInternal(node: unknown, candidates: Set<string>): string | undefined {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findFirstStringForKeysInternal(item, candidates)
      if (found) {
        return found
      }
    }
    return undefined
  }

  if (!isRecord(node)) {
    return undefined
  }

  for (const [key, value] of Object.entries(node)) {
    if (isAttributeKey(key)) {
      continue
    }

    if (candidates.has(key.toLowerCase())) {
      const text = readLeafText(value)
      if (text) {
        return text
      }
    }

    const found = findFirstStringForKeysInternal(value, candidates)
    if (found) {
      return found
    }
  }

  return undefined
}

function readLeafText(node: unknown): string | undefined {
  if (node == null) {
    return undefined
  }

  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
    const text = String(node).trim()
    return text || undefined
  }

  if (Array.isArray(node)) {
    const values = node.map(readLeafText).filter((value): value is string => Boolean(value))
    if (values.length === 0) {
      return undefined
    }
    return values.join(' ')
  }

  if (!isRecord(node)) {
    return undefined
  }

  if ('#text' in node) {
    return readLeafText(node['#text'])
  }

  for (const [key, value] of Object.entries(node)) {
    if (isAttributeKey(key)) {
      continue
    }
    const text = readLeafText(value)
    if (text) {
      return text
    }
  }

  return undefined
}

function readOrderedLeafText(node: unknown): string | undefined {
  if (node == null) {
    return undefined
  }

  if (Array.isArray(node)) {
    const values = node
      .map((item) => readOrderedLeafText(item))
      .filter((value): value is string => Boolean(value))
    if (values.length === 0) {
      return undefined
    }
    return values.join('')
  }

  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
    return String(node)
  }

  if (!isRecord(node)) {
    return undefined
  }

  if ('#text' in node) {
    return readOrderedLeafText(node['#text'])
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === ':@' || isAttributeKey(key)) {
      continue
    }
    const text = readOrderedLeafText(value)
    if (text != null) {
      return text
    }
  }

  return undefined
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAttributeKey(key: string): boolean {
  return key.startsWith('@_') || key === '?xml'
}
