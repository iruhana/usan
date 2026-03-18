/**
 * PDF Engine — Read + Create/Edit
 * Read: pdf-parse (already in stack)
 * Create/Edit: pdf-lib (pure JS, zero native deps)
 */

import { readFile, writeFile } from 'fs/promises'

// Lazy imports to avoid loading heavy modules until needed
let pdfParse: typeof import('pdf-parse') | null = null
let pdfLib: typeof import('pdf-lib') | null = null

type PdfParseModule = {
  default?: typeof import('pdf-parse')
}

async function getPdfParse() {
  if (!pdfParse) {
    const mod = await import('pdf-parse') as unknown as PdfParseModule
    pdfParse = mod.default ?? (mod as unknown as typeof import('pdf-parse'))
  }
  return pdfParse
}

async function getPdfLib() {
  if (!pdfLib) pdfLib = await import('pdf-lib')
  return pdfLib
}

export interface PdfReadResult {
  text: string
  pages: number
  info: Record<string, unknown>
}

export interface PdfCreateOptions {
  title?: string
  author?: string
  fontSize?: number
}

/**
 * Extract text from a PDF file
 */
export async function readPdf(filePath: string): Promise<PdfReadResult> {
  const parse = await getPdfParse()
  const buffer = await readFile(filePath)
  const result = await parse(buffer)
  return {
    text: result.text,
    pages: result.numpages,
    info: result.info as Record<string, unknown>,
  }
}

/**
 * Create a new PDF from text content
 */
export async function createPdf(
  content: string,
  outputPath: string,
  options: PdfCreateOptions = {}
): Promise<string> {
  const { PDFDocument, StandardFonts, rgb } = await getPdfLib()
  const doc = await PDFDocument.create()

  if (options.title) doc.setTitle(options.title)
  if (options.author) doc.setAuthor(options.author)

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontSize = options.fontSize ?? 12
  const margin = 50
  const lineHeight = fontSize * 1.4

  const lines = content.split('\n')
  let page = doc.addPage()
  let { height } = page.getSize()
  let y = height - margin

  for (const line of lines) {
    if (y < margin + lineHeight) {
      page = doc.addPage()
      height = page.getSize().height
      y = height - margin
    }
    page.drawText(line, {
      x: margin,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    })
    y -= lineHeight
  }

  const bytes = await doc.save()
  await writeFile(outputPath, bytes)
  return outputPath
}

/**
 * Merge multiple PDFs into one
 */
export async function mergePdfs(
  inputPaths: string[],
  outputPath: string
): Promise<string> {
  const { PDFDocument } = await getPdfLib()
  const merged = await PDFDocument.create()

  for (const path of inputPaths) {
    const buffer = await readFile(path)
    const source = await PDFDocument.load(buffer)
    const pages = await merged.copyPages(source, source.getPageIndices())
    for (const page of pages) {
      merged.addPage(page)
    }
  }

  const bytes = await merged.save()
  await writeFile(outputPath, bytes)
  return outputPath
}

/**
 * Extract specific page range from a PDF
 */
export async function extractPages(
  inputPath: string,
  outputPath: string,
  startPage: number,
  endPage: number
): Promise<string> {
  const { PDFDocument } = await getPdfLib()
  const buffer = await readFile(inputPath)
  const source = await PDFDocument.load(buffer)
  const doc = await PDFDocument.create()

  const start = Math.max(0, startPage - 1)
  const end = Math.min(source.getPageCount() - 1, endPage - 1)
  const indices = Array.from({ length: end - start + 1 }, (_, i) => start + i)

  const pages = await doc.copyPages(source, indices)
  for (const page of pages) {
    doc.addPage(page)
  }

  const bytes = await doc.save()
  await writeFile(outputPath, bytes)
  return outputPath
}
