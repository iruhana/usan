/**
 * DOCX Engine — Create Word documents
 * Uses: docx (pure JS)
 */

import { writeFile } from 'fs/promises'

let docxLib: typeof import('docx') | null = null

async function getDocx() {
  if (!docxLib) docxLib = await import('docx')
  return docxLib
}

export interface DocxCreateOptions {
  title?: string
  author?: string
  description?: string
}

/**
 * Create a DOCX from structured content
 */
export async function createDocx(
  paragraphs: string[],
  outputPath: string,
  options: DocxCreateOptions = {}
): Promise<string> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await getDocx()

  const children = paragraphs.map((text) => {
    // Lines starting with # are headings
    if (text.startsWith('# ')) {
      return new Paragraph({
        children: [new TextRun({ text: text.slice(2), bold: true, size: 32 })],
        heading: HeadingLevel.HEADING_1,
      })
    }
    if (text.startsWith('## ')) {
      return new Paragraph({
        children: [new TextRun({ text: text.slice(3), bold: true, size: 28 })],
        heading: HeadingLevel.HEADING_2,
      })
    }
    if (text.startsWith('### ')) {
      return new Paragraph({
        children: [new TextRun({ text: text.slice(4), bold: true, size: 24 })],
        heading: HeadingLevel.HEADING_3,
      })
    }
    return new Paragraph({
      children: [new TextRun({ text, size: 22 })],
    })
  })

  const doc = new Document({
    creator: options.author ?? 'Usan',
    title: options.title,
    description: options.description,
    sections: [{ children }],
  })

  const buffer = await Packer.toBuffer(doc)
  await writeFile(outputPath, buffer)
  return outputPath
}

/**
 * Create a DOCX from markdown-like text (simple conversion)
 */
export async function markdownToDocx(
  markdown: string,
  outputPath: string,
  options: DocxCreateOptions = {}
): Promise<string> {
  const lines = markdown.split('\n').filter((l) => l.trim() !== '')
  return createDocx(lines, outputPath, options)
}
