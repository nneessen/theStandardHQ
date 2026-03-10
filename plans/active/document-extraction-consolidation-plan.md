# Document Extraction Consolidation Plan

## Objective

Consolidate PDF extraction and OCR into a single backend capability with one contract, while keeping PDF viewing and PDF export concerns separate.

The first migration target is the underwriting guide pipeline. Training module import is the second candidate, but only after parity or improvement is proven against the current external extractor.

## Why This Plan Exists

The repository currently uses PDFs in multiple ways, but those uses are not the same problem:

- PDF viewing in the UI via `react-pdf`
- PDF export via browser print/report flows
- PDF extraction for underwriting guides
- PDF extraction for training module import
- static data that was manually extracted from PDFs in the past

Only the extraction/OCR paths should be consolidated.

## Current State

### 1. Underwriting guide parsing

- Runtime path exists today.
- Uploads accept PDF-only files.
- Parsing happens in `supabase/functions/parse-underwriting-guide/index.ts`.
- Current implementation is text-layer extraction using `unpdf` + PDF.js.
- Parsed output is stored in `underwriting_guides.parsed_content`.
- AI criteria extraction then reads that parsed content and writes structured criteria to `carrier_underwriting_criteria`.

### 2. Training module PDF import

- Runtime path exists today.
- Extraction is delegated to an external `/api/pdf-extract` service.
- Output is richer than UW today and includes structured sections like `lessons`, `tables`, and `pages`.

### 3. Settings / carriers / products

- No live PDF parser path is currently used here.
- Product bulk import is CSV-only.
- Commission guide import uses hardcoded data that was already extracted from a PDF outside the runtime path.

### 4. PDF viewing/export

- `react-pdf` is used for viewing.
- Report/export features generate PDFs for output.
- These are not OCR problems and should not be mixed into extraction work.

## Problem Statement

The extraction layer is fragmented:

- UW uses one extraction path and fails on scanned or layout-heavy PDFs.
- Training uses a different external extractor.
- There is no shared extraction contract, versioning, or benchmark process.
- The app risks accumulating more one-off parser paths over time.

The underwriting docs already describe the main weakness:

- UW parsing is still text-only extraction from PDF text layers.
- It is fragile for scanned, image-based, table-heavy, and mixed-layout guides.

## Decision

Introduce one document extraction capability with one service contract.

Use PaddleOCR only as a candidate implementation for OCR/document parsing behind that contract. Do not adopt it as a general-purpose PDF library across the app.

## Architectural Direction

### Boundary

Create a dedicated `document-extraction` backend boundary responsible for:

- file ingestion
- extractor routing
- OCR/layout/table extraction
- normalized page/block/table output
- extractor metadata and warnings

This boundary should be treated as infrastructure behind a stable application-facing contract.

### Non-Goals

- replacing `react-pdf`
- replacing report/export PDF generation
- changing settings/product CSV imports
- shipping a third independent extraction path

## Target Contract

Define one canonical extraction request/response contract.

### Request

- `source`
  - uploaded file
  - storage path
  - signed URL
- `mode`
  - `uw_guide`
  - `training_module`
  - future modes only if justified
- `features`
  - `text`
  - `ocr`
  - `layout`
  - `tables`
- `options`
  - page ranges
  - timeout tier
  - fallback behavior

### Response

- `documentId`
- `extractor`
  - provider name
  - provider version
  - pipeline version
- `metadata`
  - title
  - page count
  - source type
- `pages`
  - page number
  - text
  - blocks
  - detected tables
  - OCR used flag
- `fullText`
- `tables`
- `warnings`
- `confidence`

The contract must support both:

- UW criteria extraction from normalized page text and table data
- training module generation from structured content

## Proposed Implementation Strategy

### Phase 0: Baseline and benchmark

Before changing production behavior:

- build a benchmark corpus of representative PDFs
- snapshot current UW outputs
- snapshot current training outputs
- define success metrics

Benchmark corpus must include:

- clean text-layer UW guides
- scanned/image-only UW guides
- mixed-layout carrier guides
- table-heavy impairment/build guides
- current training PDFs that produce acceptable results today

Metrics:

- extraction success rate
- field coverage for UW criteria
- table recovery quality
- lesson segmentation quality for training
- latency per document
- cost per document
- operational complexity

### Phase 1: Create the service boundary

Introduce one extraction gateway and adapter layer.

Initial design:

- application layer:
  - `ExtractDocument` use case
  - mode-specific DTOs
- domain layer:
  - normalized extraction result entities/value objects
- infrastructure layer:
  - current training extractor adapter
  - current UW extractor adapter
  - candidate PaddleOCR adapter

This keeps consumers from depending directly on `unpdf`, external HTTP payloads, or provider-specific response shapes.

### Phase 2: Migrate UW first

Replace direct UW parsing implementation with the shared extraction service.

Target behavior:

- keep the existing guide upload flow
- replace direct text-layer parsing with extraction through the new boundary
- continue storing parsed output in `underwriting_guides.parsed_content`, but store canonical normalized extraction data
- preserve current criteria extraction workflow until the new parser is proven

Routing policy for UW:

- if text layer is reliable, cheap text extraction may be allowed
- if scanned, image-heavy, or table-heavy, route to OCR/layout extraction
- if routing confidence is low, prefer the richer extractor

### Phase 3: Evaluate PaddleOCR for UW production cutover

PaddleOCR is a fit if it materially improves:

- scanned guide extraction
- table recovery
- mixed-layout handling
- page-level structure retention

PaddleOCR should run as a separate service, not inside Supabase Edge Functions.

Deployment options:

- dedicated OCR service
- worker/container service with HTTP API
- internal extraction service that can route between providers

### Phase 4: Training parity decision

After UW is stable:

- compare PaddleOCR-backed training extraction against the current external training extractor
- keep the current training extractor if it remains better
- consolidate only if PaddleOCR reaches parity or better on lesson/table outputs

This phase is optional. Consolidation is desirable, but not at the expense of training import quality.

### Phase 5: Canonical parsed document format

Standardize persisted extraction payloads.

For UW persisted results, add:

- extractor provider
- extractor version
- pipeline version
- OCR/layout flags
- canonical pages and tables
- warning codes

This avoids opaque `fullText`-only storage and gives downstream consumers stable inputs.

## Integration Plan by Feature

### Underwriting

Keep:

- guide upload UX
- criteria extraction workflow
- criteria review/approval workflow
- downstream deterministic and AI recommendation consumers

Change:

- guide parsing implementation
- persisted parsed-content format
- extraction observability and version metadata

### Training

Keep:

- training module transform and seeding flow
- current user workflow

Change later, only if justified:

- provider behind extraction endpoint
- normalization logic to use the shared contract

### Settings / products / carriers

No migration needed now.

Possible later follow-up:

- if the business wants runtime commission-guide ingestion from PDFs, it should use the same extraction boundary rather than bespoke import code

## DDD and Ownership Rules

To avoid another round of drift:

- React components and hooks must not call provider-specific extraction APIs directly
- provider-specific request/response mapping belongs in infrastructure adapters
- mode-specific orchestration belongs in application use cases
- downstream features consume normalized extraction results, not raw provider payloads

## Rollout Plan

### Step 1

Ship the shared extraction contract and adapters behind a feature flag.

### Step 2

Run UW extraction in shadow mode on the benchmark corpus and selected real documents.

### Step 3

Compare:

- current UW parser output
- PaddleOCR-backed output
- downstream criteria extraction quality

### Step 4

Cut UW to the new extraction boundary when benchmarks meet acceptance criteria.

### Step 5

Decide whether training should remain on the current external extractor or move to the new provider.

## Acceptance Criteria

UW cutover is allowed only if all of the following are true:

- scanned/image-heavy guides materially improve over the current parser
- no regression on clean text-layer guides
- table extraction improves or remains acceptable for build/impairment pages
- downstream criteria extraction produces equal or better field coverage
- operational cost and latency are acceptable
- persisted extraction results include version metadata and warnings

Training cutover is allowed only if:

- lesson segmentation is at least as good as the current extractor
- tables are preserved well enough for training content generation
- failure rate is not worse than the current path

## Risks

- PaddleOCR may improve OCR but still underperform the current training extractor for lesson segmentation
- OCR quality may be better than text extraction but slower and more expensive
- provider output drift can break downstream assumptions if canonical normalization is weak
- migrating persisted parsed content without versioning will create long-term schema confusion

## Open Questions

- should routing be rule-based, confidence-based, or always use the richer extractor for UW?
- should the canonical parsed document be stored in the database as JSONB or split across tables for pages/tables?
- does the current external training extractor provide capabilities PaddleOCR cannot yet match without custom post-processing?
- what is the acceptable latency budget for admin-only UW guide ingestion?

## Recommended First Implementation Slice

Build the smallest slice that proves the architecture:

1. Create the shared extraction contract and service boundary.
2. Add a PaddleOCR-backed adapter behind a standalone HTTP service.
3. Route UW parsing through the new boundary only.
4. Persist canonical parsed document metadata alongside extracted content.
5. Benchmark real UW guides before changing training.

## Deliverables

- shared extraction contract
- extraction gateway/use case
- provider adapters
- canonical parsed document schema
- benchmark corpus and evaluation checklist
- UW feature flag and cutover plan
- training parity report
