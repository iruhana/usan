/**
 * XLSX Engine — Read/Write Excel files
 * Uses: exceljs (pure JS)
 */

let excelLib: typeof import('exceljs') | null = null

async function getExcel() {
  if (!excelLib) excelLib = await import('exceljs')
  return excelLib
}

export interface SheetData {
  name: string
  headers: string[]
  rows: (string | number | boolean | null)[][]
}

export interface XlsxReadResult {
  sheets: SheetData[]
  sheetCount: number
}

/**
 * Read an XLSX file into structured data
 */
export async function readXlsx(filePath: string): Promise<XlsxReadResult> {
  const ExcelJS = await getExcel()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)

  const sheets: SheetData[] = []

  workbook.eachSheet((worksheet) => {
    const headers: string[] = []
    const rows: (string | number | boolean | null)[][] = []

    worksheet.eachRow((row, rowNumber) => {
      const values = row.values as (string | number | boolean | null)[]
      // ExcelJS row.values is 1-indexed, first element is undefined
      const cells = values.slice(1).map((v) => v ?? null)

      if (rowNumber === 1) {
        headers.push(...cells.map(String))
      } else {
        rows.push(cells)
      }
    })

    sheets.push({ name: worksheet.name, headers, rows })
  })

  return { sheets, sheetCount: sheets.length }
}

/**
 * Create an XLSX file from structured data
 */
export async function createXlsx(
  sheets: SheetData[],
  outputPath: string
): Promise<string> {
  const ExcelJS = await getExcel()
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Usan'
  workbook.created = new Date()

  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name)

    // Add header row with bold styling
    const headerRow = ws.addRow(sheet.headers)
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    }

    // Add data rows
    for (const row of sheet.rows) {
      ws.addRow(row)
    }

    // Auto-fit column widths (approximate)
    ws.columns.forEach((col) => {
      let maxLen = 10
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = String(cell.value ?? '').length
        if (len > maxLen) maxLen = len
      })
      col.width = Math.min(maxLen + 2, 50)
    })
  }

  await workbook.xlsx.writeFile(outputPath)
  return outputPath
}

/**
 * Convert XLSX sheet to CSV string
 */
export async function xlsxToCsv(filePath: string, sheetName?: string): Promise<string> {
  const result = await readXlsx(filePath)
  const sheet = sheetName
    ? result.sheets.find((s) => s.name === sheetName)
    : result.sheets[0]

  if (!sheet) throw new Error(`Sheet "${sheetName ?? 'first'}" not found`)

  const lines = [sheet.headers.join(',')]
  for (const row of sheet.rows) {
    lines.push(row.map((v) => {
      const str = String(v ?? '')
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
    }).join(','))
  }
  return lines.join('\n')
}
