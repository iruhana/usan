import AdmZip from 'adm-zip'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'

import { readHwpx, hwpxToText } from '../../src/main/documents/hwpx-engine'
import { extractTextFromFile } from '../../src/main/rag/chunker'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('hwpx-engine', () => {
  it('reads HWPX sections in numeric order and extracts metadata', async () => {
    const filePath = await createSampleHwpx()

    const result = await readHwpx(filePath)

    expect(result.sectionCount).toBe(2)
    expect(result.paragraphCount).toBe(4)
    expect(result.metadata.title).toBe('민원 신청서')
    expect(result.metadata.creator).toBe('Usan Test')
    expect(result.metadata.language).toBe('ko-KR')
    expect(result.metadata.manifestEntries).toContain('Contents/section0.xml')
    expect(result.sections.map((section) => section.path)).toEqual([
      'Contents/section0.xml',
      'Contents/section1.xml',
    ])
    expect(result.text).toBe([
      '첫 번째 문단',
      '둘째 줄\n개행',
      '표 셀 텍스트',
      '마지막 섹션',
    ].join('\n\n'))
  })

  it('routes .hwpx extraction through the shared file text extractor', async () => {
    const filePath = await createSampleHwpx()

    const text = await extractTextFromFile(filePath)

    expect(text).toContain('첫 번째 문단')
    expect(text).toContain('표 셀 텍스트')
    expect(await hwpxToText(filePath)).toBe(text)
  })

  it('rejects invalid HWPX archives without section XML', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'usan-hwpx-invalid-'))
    tempDirs.push(dir)
    const filePath = join(dir, 'invalid.hwpx')
    const zip = new AdmZip()
    zip.addFile('Contents/header.xml', Buffer.from('<head><title>Broken</title></head>', 'utf8'))
    zip.writeZip(filePath)

    await expect(readHwpx(filePath)).rejects.toThrow('Invalid HWPX file: no section XML files found.')
  })

  it('rejects archives with excessive section counts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'usan-hwpx-too-many-sections-'))
    tempDirs.push(dir)
    const filePath = join(dir, 'too-many.hwpx')
    const zip = new AdmZip()
    zip.addFile('Contents/header.xml', Buffer.from('<head><title>Overflow</title></head>', 'utf8'))

    for (let i = 0; i < 129; i += 1) {
      zip.addFile(
        `Contents/section${i}.xml`,
        Buffer.from(`<hp:section xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"><hp:p><hp:run><hp:t>${i}</hp:t></hp:run></hp:p></hp:section>`, 'utf8'),
      )
    }

    zip.writeZip(filePath)

    await expect(readHwpx(filePath)).rejects.toThrow('Invalid HWPX file: too many section XML files (129).')
  })
})

async function createSampleHwpx(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'usan-hwpx-'))
  tempDirs.push(dir)

  const filePath = join(dir, 'sample.hwpx')
  const zip = new AdmZip()

  zip.addFile('META-INF/manifest.xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:full-path="/" />
  <manifest:file-entry manifest:full-path="Contents/header.xml" />
  <manifest:file-entry manifest:full-path="Contents/section0.xml" />
  <manifest:file-entry manifest:full-path="Contents/section1.xml" />
</manifest:manifest>`, 'utf8'))

  zip.addFile('Contents/header.xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<hh:header xmlns:hh="http://www.hancom.co.kr/hwpml/2016/head">
  <hh:title>민원 신청서</hh:title>
  <hh:creator>Usan Test</hh:creator>
  <hh:language>ko-KR</hh:language>
</hh:header>`, 'utf8'))

  zip.addFile('Contents/section1.xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<hp:section xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">
  <hp:p>
    <hp:run>
      <hp:t>마지막 섹션</hp:t>
    </hp:run>
  </hp:p>
</hp:section>`, 'utf8'))

  zip.addFile('Contents/section0.xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<hp:section xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">
  <hp:p>
    <hp:run>
      <hp:t>첫 번째 문단</hp:t>
    </hp:run>
  </hp:p>
  <hp:p>
    <hp:run>
      <hp:t>둘째 줄</hp:t>
      <hp:lineBreak />
      <hp:t>개행</hp:t>
    </hp:run>
  </hp:p>
  <hp:tbl>
    <hp:tr>
      <hp:tc>
        <hp:p>
          <hp:run>
            <hp:t>표 셀 텍스트</hp:t>
          </hp:run>
        </hp:p>
      </hp:tc>
    </hp:tr>
  </hp:tbl>
</hp:section>`, 'utf8'))

  zip.writeZip(filePath)
  return filePath
}
