# HWPX Parser Implementation Status

Date: 2026-03-18
Project: USAN Desktop
Scope: Native HWPX reading support for Korean government and enterprise document workflows

## 1. Summary

The HWPX parser is now implemented in the desktop document engine and wired into the shared text-extraction path used by RAG indexing.

The current implementation supports:

- reading `.hwpx` files as ZIP-based XML containers
- extracting text from `Contents/section*.xml` in numeric section order
- preserving paragraph-level ordering, including explicit line breaks
- reading basic metadata from `Contents/header.xml`
- reading manifest entry paths from `META-INF/manifest.xml`
- routing `.hwpx` files through the same `extractTextFromFile()` path used by the document indexer

This closes the initial parser milestone for Task N.

## 2. Implementation Details

The parser lives in `apps/desktop/src/main/documents/hwpx-engine.ts`.

Implementation choices:

- archive handling uses `adm-zip`
- XML parsing uses `fast-xml-parser`
- metadata parsing uses standard object-mode XML parsing
- section text parsing uses `preserveOrder` mode so inline `lineBreak` nodes are not reordered away from adjacent text runs

The exported API is:

- `readHwpx(filePath)`
- `hwpxToText(filePath)`

Returned data includes:

- full extracted text
- section count
- paragraph count
- per-section extracted text
- basic metadata (`title`, `subject`, `creator`, `language`, `manifestEntries`)

## 3. Files Added Or Updated

- `apps/desktop/src/main/documents/hwpx-engine.ts`
- `apps/desktop/src/main/documents/index.ts`
- `apps/desktop/src/main/rag/chunker.ts`
- `apps/desktop/src/main/file-org/file-categorizer.ts`
- `apps/desktop/src/main/ai/tools/fs-tools.ts`
- `apps/desktop/src/main/documents/pdf-engine.ts`
- `apps/desktop/tests/unit/hwpx-engine.test.ts`
- `apps/desktop/package.json`

## 4. Dependency Changes

The following document-related dependencies are now installed in `apps/desktop`:

- `adm-zip`
- `fast-xml-parser`
- `docx`
- `pdf-lib`
- `exceljs`
- `pptxgenjs`
- `@types/adm-zip`
- `@types/pdf-parse`

The additional document packages were installed to bring the existing document engine surface back into a type-checkable state while adding HWPX support.

## 5. Validation Status

The following validation steps passed:

- `npm run typecheck:node`
- `npx vitest run tests/unit/hwpx-engine.test.ts tests/unit/document-indexer.test.ts`
- targeted `eslint` checks for the updated document and extraction files

The HWPX unit tests cover:

- section ordering (`section0.xml` before `section1.xml`)
- paragraph extraction
- inline line-break preservation
- metadata extraction
- manifest extraction
- routing through `extractTextFromFile()`
- invalid archive rejection when section XML is missing

## 6. Known Gaps

The current implementation intentionally does not cover:

- legacy binary `.hwp` parsing
- writing or modifying `.hwpx` files
- image extraction from `BinData/`
- rich table reconstruction beyond plain text extraction
- style, layout, footnote, or annotation fidelity

## 7. Recommended Next Steps

Recommended follow-up work:

1. Add `BinData/` image extraction when artifact workflows need embedded asset access.
2. Add richer table-aware extraction if downstream Korean document workflows depend on structured cells instead of plain text.
3. Add `.hwpx` conversion helpers if export or cross-format conversion becomes a product requirement.
4. Keep `.hwp` support separate; it should not be mixed into this XML-based parser.

## 8. Status Statement

Current status: implemented, integrated into the document engine and RAG extraction path, tested, and ready for production use on `.hwpx` text extraction.
