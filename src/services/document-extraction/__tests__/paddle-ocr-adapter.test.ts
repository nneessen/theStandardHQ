import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ExtractionRequest } from "../../../types/document-extraction.types";

// ─── Supabase mock ────────────────────────────────────────────────────────────

const {
  mockDownload,
  mockUpdate,
  mockUpdateEq,
  mockPreflightNeq,
  mockFrom,
  mockFromTable,
} = vi.hoisted(() => ({
  mockDownload: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateEq: vi.fn(),
  mockPreflightNeq: vi.fn(),
  mockFrom: vi.fn(),
  mockFromTable: vi.fn(),
}));

vi.mock("../../base/supabase", () => ({
  supabase: {
    storage: {
      from: (bucket: string) => {
        mockFrom(bucket);
        return {
          download: (path: string) => mockDownload(path),
        };
      },
    },
    from: (table: string) => {
      mockFromTable(table);
      return {
        update: (data: Record<string, unknown>, options?: unknown) => {
          mockUpdate(data, options);
          return {
            eq: (...args: unknown[]) => {
              const directResult = mockUpdateEq(...args);
              // Return object that is both thenable (for direct await)
              // and chainable (for .neq() pre-flight chain)
              return {
                neq: () => mockPreflightNeq(),
                then: (
                  resolve: (v: unknown) => void,
                  reject?: (e: unknown) => void,
                ) =>
                  (directResult instanceof Promise
                    ? directResult
                    : Promise.resolve(directResult)
                  ).then(resolve, reject),
              };
            },
          };
        },
      };
    },
  },
}));

// Mock global fetch
const mockFetch =
  vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
vi.stubGlobal("fetch", mockFetch);

import { PaddleOcrAdapter } from "../adapters/paddle-ocr-adapter";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePaddleResponse(overrides: Record<string, unknown> = {}) {
  return {
    document_id: "doc-paddle-1",
    page_count: 2,
    pages: [
      {
        page_number: 1,
        width: 612,
        height: 792,
        text: "Page one heading\nPage one body text",
        blocks: [
          {
            block_id: "p1-b0",
            type: "heading",
            text: "Page one heading",
            confidence: 0.95,
            bbox: [50, 50, 500, 80],
          },
          {
            block_id: "p1-b1",
            type: "paragraph",
            text: "Page one body text",
            confidence: 0.88,
            bbox: [50, 100, 500, 300],
          },
        ],
        tables: [],
      },
      {
        page_number: 2,
        width: 612,
        height: 792,
        text: "Build chart data",
        blocks: [
          {
            block_id: "p2-b0",
            type: "table",
            text: "[Table: 3x4]",
            table_id: "t-p2-0",
            confidence: 0.82,
            bbox: [50, 50, 550, 400],
          },
        ],
        tables: [
          {
            table_id: "t-p2-0",
            page_number: 2,
            table_index: 0,
            rows: 3,
            cols: 4,
            values: [
              ["Height", "Weight", "Class", "Rate"],
              ["5'10", "180", "Preferred", "1.2"],
              ["5'10", "220", "Standard", "1.8"],
            ],
            html: "<table>...</table>",
            confidence: 0.82,
            source_engine: "paddleocr",
          },
        ],
      },
    ],
    tables: [
      {
        table_id: "t-p2-0",
        page_number: 2,
        table_index: 0,
        rows: 3,
        cols: 4,
        values: [
          ["Height", "Weight", "Class", "Rate"],
          ["5'10", "180", "Preferred", "1.2"],
          ["5'10", "220", "Standard", "1.8"],
        ],
        html: "<table>...</table>",
        confidence: 0.82,
        source_engine: "paddleocr",
      },
    ],
    processing_time_ms: 4500,
    engine_version: "paddleocr-pp-structure-2.9.1",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeRequest(
  overrides?: Partial<ExtractionRequest>,
): ExtractionRequest {
  return {
    source: {
      type: "file",
      file: new File(["fake-pdf"], "test.pdf", { type: "application/pdf" }),
    },
    mode: "uw_guide",
    features: { ocr: true },
    context: { guideId: "guide-abc" },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PaddleOcrAdapter", () => {
  let adapter: PaddleOcrAdapter;

  beforeEach(() => {
    adapter = new PaddleOcrAdapter();
    mockFetch.mockReset();
    mockUpdate.mockClear();
    mockUpdateEq.mockReset().mockResolvedValue({ error: null });
    mockPreflightNeq.mockReset().mockResolvedValue({ count: 1, error: null });
    mockFrom.mockClear();
    mockFromTable.mockClear();
    mockDownload.mockReset().mockResolvedValue({
      data: new Blob(["fake-pdf"], { type: "application/pdf" }),
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── canHandle routing ────────────────────────────────────────────────

  describe("canHandle", () => {
    it("accepts uw_guide with ocr feature", () => {
      expect(adapter.canHandle(makeRequest({ features: { ocr: true } }))).toBe(
        true,
      );
    });

    it("accepts uw_guide with tables feature", () => {
      expect(
        adapter.canHandle(makeRequest({ features: { tables: true } })),
      ).toBe(true);
    });

    it("accepts uw_guide with layout feature", () => {
      expect(
        adapter.canHandle(makeRequest({ features: { layout: true } })),
      ).toBe(true);
    });

    it("rejects uw_guide with no features", () => {
      expect(adapter.canHandle(makeRequest({ features: undefined }))).toBe(
        false,
      );
    });

    it("rejects uw_guide with only text feature", () => {
      expect(adapter.canHandle(makeRequest({ features: { text: true } }))).toBe(
        false,
      );
    });

    it("rejects training_module mode", () => {
      expect(
        adapter.canHandle(
          makeRequest({ mode: "training_module", features: { ocr: true } }),
        ),
      ).toBe(false);
    });
  });

  // ─── extract + normalize ──────────────────────────────────────────────

  describe("extract", () => {
    it("sends FormData to OCR service and normalizes response", async () => {
      mockFetch.mockResolvedValue(jsonResponse(makePaddleResponse()));

      const result = await adapter.extract(makeRequest());

      // Find the OCR service call (not the status update calls)
      const ocrCall = mockFetch.mock.calls.find(
        ([url]) => url === "/api/paddle-ocr",
      );
      expect(ocrCall).toBeDefined();
      expect(ocrCall![1]?.method).toBe("POST");
      expect(ocrCall![1]?.body).toBeInstanceOf(FormData);

      expect(result.documentId).toBe("doc-paddle-1");
      expect(result.metadata.pageCount).toBe(2);
      expect(result.metadata.sourceType).toBe("scanned");
      expect(result.extractor.provider).toBe("paddle-ocr");
      expect(result.extractor.providerVersion).toBe(
        "paddleocr-pp-structure-2.9.1",
      );
    });

    it("normalizes pages with correct structure", async () => {
      mockFetch.mockResolvedValue(jsonResponse(makePaddleResponse()));

      const result = await adapter.extract(makeRequest());

      expect(result.pages).toHaveLength(2);
      expect(result.pages[0].ocrUsed).toBe(true);
      expect(result.pages[0].blocks).toHaveLength(2);
      expect(result.pages[0].blocks[0].type).toBe("heading");
      expect(result.pages[0].blocks[1].type).toBe("paragraph");
    });

    it("normalizes tables correctly", async () => {
      mockFetch.mockResolvedValue(jsonResponse(makePaddleResponse()));

      const result = await adapter.extract(makeRequest());

      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].tableId).toBe("t-p2-0");
      expect(result.tables[0].rows).toBe(3);
      expect(result.tables[0].cols).toBe(4);
      expect(result.tables[0].values[0]).toEqual([
        "Height",
        "Weight",
        "Class",
        "Rate",
      ]);
      expect(result.tables[0].sourceEngine).toBe("paddleocr");

      expect(result.pages[1].tables).toHaveLength(1);
      expect(result.pages[1].blocks[0].type).toBe("table_ref");
      expect(result.pages[1].blocks[0].tableId).toBe("t-p2-0");
    });

    it("assembles fullText from all pages", async () => {
      mockFetch.mockResolvedValue(jsonResponse(makePaddleResponse()));

      const result = await adapter.extract(makeRequest());

      expect(result.fullText).toContain("Page one heading");
      expect(result.fullText).toContain("Build chart data");
    });

    it("includes table text in fullText when service embeds it in page text", async () => {
      // The real PaddleOCR service builds page.text from all blocks including
      // pipe-separated table rows (app.py:99-105). Verify the adapter preserves
      // table content in fullText for downstream validation (>= 5000 chars).
      const response = makePaddleResponse();
      response.pages[1].text =
        "Build chart data\nHeight | Weight | Class | Rate\n5'10 | 180 | Preferred | 1.2\n5'10 | 220 | Standard | 1.8";

      mockFetch.mockResolvedValue(jsonResponse(response));

      const result = await adapter.extract(makeRequest());

      expect(result.fullText).toContain("Height | Weight | Class | Rate");
      expect(result.fullText).toContain("5'10 | 180 | Preferred | 1.2");
    });

    it("computes aggregate confidence from block confidences", async () => {
      mockFetch.mockResolvedValue(jsonResponse(makePaddleResponse()));

      const result = await adapter.extract(makeRequest());

      // Blocks: 0.95, 0.88, 0.82 → avg ≈ 0.883
      expect(result.confidence).toBeCloseTo(0.883, 2);
    });

    it("passes through context", async () => {
      mockFetch.mockResolvedValue(jsonResponse(makePaddleResponse()));

      const result = await adapter.extract(
        makeRequest({ context: { guideId: "g-123" } }),
      );

      expect(result.context).toEqual({ guideId: "g-123" });
    });

    it("includes X-API-Key header when VITE_PADDLEOCR_API_KEY is set", async () => {
      vi.stubEnv("VITE_PADDLEOCR_API_KEY", "test-ocr-key-42");
      mockFetch.mockResolvedValue(jsonResponse(makePaddleResponse()));

      await adapter.extract(makeRequest());

      const ocrCall = mockFetch.mock.calls.find(
        ([url]) => url === "/api/paddle-ocr",
      );
      expect(ocrCall).toBeDefined();
      const headers = ocrCall![1]?.headers as Record<string, string>;
      expect(headers["X-API-Key"]).toBe("test-ocr-key-42");

      vi.unstubAllEnvs();
    });

    it("omits X-API-Key header when env var is not set", async () => {
      vi.stubEnv("VITE_PADDLEOCR_API_KEY", "");
      mockFetch.mockResolvedValue(jsonResponse(makePaddleResponse()));

      await adapter.extract(makeRequest());

      const ocrCall = mockFetch.mock.calls.find(
        ([url]) => url === "/api/paddle-ocr",
      );
      const headers = ocrCall![1]?.headers as Record<string, string>;
      expect(headers["X-API-Key"]).toBeUndefined();

      vi.unstubAllEnvs();
    });
  });

  // ─── DB persistence ───────────────────────────────────────────────────

  describe("DB persistence", () => {
    it("atomically sets parsing_status to 'processing' via pre-flight UPDATE", async () => {
      mockFetch.mockResolvedValue(jsonResponse(makePaddleResponse()));

      await adapter.extract(makeRequest());

      // First update call is the atomic pre-flight (sets processing + checks ownership)
      const preflightCall = mockUpdate.mock.calls[0];
      expect(preflightCall[0]).toEqual({
        parsing_status: "processing",
        parsing_error: null,
      });
      // Second arg should be { count: "exact" }
      expect(preflightCall[1]).toEqual({ count: "exact" });
    });

    it("persists parsed_content in UwParsedContent format on success", async () => {
      mockFetch.mockResolvedValue(jsonResponse(makePaddleResponse()));

      await adapter.extract(makeRequest());

      // Second update call = persist (after pre-flight + OCR)
      const persistCall = mockUpdate.mock.calls[1];
      expect(persistCall[0]).toHaveProperty("parsing_status", "completed");
      expect(persistCall[0]).toHaveProperty("parsing_error", null);

      const parsedContent = JSON.parse(persistCall[0].parsed_content);
      expect(parsedContent.fullText).toContain("Page one heading");
      expect(parsedContent.sections).toHaveLength(2);
      expect(parsedContent.sections[0]).toEqual({
        pageNumber: 1,
        content: "Page one heading\nPage one body text",
      });
      expect(parsedContent.pageCount).toBe(2);
      expect(parsedContent.extractedAt).toBeDefined();
      expect(parsedContent.metadata).toBeDefined();
    });

    it("targets the correct guide ID for updates", async () => {
      mockFetch.mockResolvedValue(jsonResponse(makePaddleResponse()));

      await adapter.extract(
        makeRequest({ context: { guideId: "guide-specific-id" } }),
      );

      expect(mockFromTable).toHaveBeenCalledWith("underwriting_guides");
    });

    it("sets parsing_status to 'failed' with error on OCR failure", async () => {
      mockFetch.mockRejectedValue(new Error("fetch failed"));

      await expect(adapter.extract(makeRequest())).rejects.toThrow(
        "OCR service unreachable",
      );

      // Should have: 1) pre-flight (processing), 2) failed status
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      const failCall = mockUpdate.mock.calls[1];
      expect(failCall[0].parsing_status).toBe("failed");
      expect(failCall[0].parsing_error).toContain("OCR service unreachable");
    });

    it("skips DB writes when no guideId in context", async () => {
      mockFetch.mockResolvedValue(jsonResponse(makePaddleResponse()));

      await adapter.extract(makeRequest({ context: undefined }));

      // No DB updates should have been made
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  // ─── Pre-flight ownership + race guard ─────────────────────────────

  describe("pre-flight ownership + race guard", () => {
    it("throws before OCR when UPDATE returns count=0 (RLS blocked or not found)", async () => {
      mockPreflightNeq.mockResolvedValue({ count: 0, error: null });

      await expect(adapter.extract(makeRequest())).rejects.toThrow(
        "not found, not accessible (requires admin), or already being parsed",
      );

      // OCR service was never called
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("throws before OCR when UPDATE returns a DB error", async () => {
      mockPreflightNeq.mockResolvedValue({
        count: null,
        error: { message: "connection timeout" },
      });

      await expect(adapter.extract(makeRequest())).rejects.toThrow(
        "Failed to acquire guide",
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("uses UPDATE with count:'exact' and neq('processing') for atomic guard", async () => {
      mockFetch.mockResolvedValue(jsonResponse(makePaddleResponse()));

      await adapter.extract(makeRequest());

      // Verify the pre-flight used UPDATE (not SELECT)
      const preflightCall = mockUpdate.mock.calls[0];
      expect(preflightCall[0]).toEqual({
        parsing_status: "processing",
        parsing_error: null,
      });
      expect(preflightCall[1]).toEqual({ count: "exact" });
      // Verify .neq() was called (race guard against concurrent parse)
      expect(mockPreflightNeq).toHaveBeenCalled();
    });

    it("skips pre-flight when no guideId in context", async () => {
      mockFetch.mockResolvedValue(jsonResponse(makePaddleResponse()));

      await adapter.extract(makeRequest({ context: undefined }));

      expect(mockPreflightNeq).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  // ─── Persistence failure warning ───────────────────────────────────

  describe("persistence failure surfacing", () => {
    it("adds PERSISTENCE_FAILED warning when DB write fails", async () => {
      mockFetch.mockResolvedValue(jsonResponse(makePaddleResponse()));
      // Pre-flight .eq() is called but its value is ignored (uses .neq() chain)
      // Persist .eq() is the second call — this one matters
      mockUpdateEq
        .mockResolvedValueOnce({ error: null }) // pre-flight .eq() — ignored
        .mockResolvedValueOnce({
          error: { message: "DB permission denied" },
        }); // persist .eq() — fails

      const result = await adapter.extract(makeRequest());

      const persistWarning = result.warnings.find(
        (w) => w.code === "PERSISTENCE_FAILED",
      );
      expect(persistWarning).toBeDefined();
      expect(persistWarning?.message).toContain("DB permission denied");
    });

    it("returns result successfully even when persistence fails", async () => {
      mockFetch.mockResolvedValue(jsonResponse(makePaddleResponse()));
      mockUpdateEq
        .mockResolvedValueOnce({ error: null }) // pre-flight .eq() — ignored
        .mockResolvedValueOnce({ error: { message: "timeout" } }); // persist .eq() — fails

      const result = await adapter.extract(makeRequest());

      // Extraction result is still valid
      expect(result.documentId).toBe("doc-paddle-1");
      expect(result.pages).toHaveLength(2);
    });
  });

  // ─── Error handling ───────────────────────────────────────────────────

  describe("error handling", () => {
    it("throws on HTTP error", async () => {
      mockFetch.mockResolvedValue(
        new Response("Internal Server Error", { status: 500 }),
      );

      await expect(adapter.extract(makeRequest())).rejects.toThrow(
        "[PaddleOcrAdapter] OCR service error 500",
      );
    });

    it("throws on timeout", async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((_, reject) => {
            reject(new DOMException("Aborted", "AbortError"));
          }),
      );

      await expect(
        adapter.extract(makeRequest({ options: { timeoutMs: 100 } })),
      ).rejects.toThrow("timed out");
    });

    it("throws on network error", async () => {
      mockFetch.mockRejectedValue(new Error("fetch failed"));

      await expect(adapter.extract(makeRequest())).rejects.toThrow(
        "OCR service unreachable",
      );
    });
  });

  // ─── Warnings ─────────────────────────────────────────────────────────

  describe("warnings", () => {
    it("warns about low-confidence pages", async () => {
      const response = makePaddleResponse();
      response.pages[0].blocks = [
        {
          block_id: "p1-b0",
          type: "paragraph",
          text: "barely readable",
          confidence: 0.3,
          bbox: [0, 0, 100, 100],
        },
      ];

      mockFetch.mockResolvedValue(jsonResponse(response));

      const result = await adapter.extract(makeRequest());
      const lowConfWarning = result.warnings.find(
        (w) => w.code === "LOW_OCR_CONFIDENCE",
      );
      expect(lowConfWarning).toBeDefined();
      expect(lowConfWarning?.pageNumber).toBe(1);
    });

    it("warns about empty pages", async () => {
      const response = makePaddleResponse();
      response.pages.push({
        page_number: 3,
        width: 612,
        height: 792,
        text: "",
        blocks: [],
        tables: [],
      });
      response.page_count = 3;

      mockFetch.mockResolvedValue(jsonResponse(response));

      const result = await adapter.extract(makeRequest());
      const emptyWarning = result.warnings.find(
        (w) => w.code === "EMPTY_PAGES",
      );
      expect(emptyWarning).toBeDefined();
      expect(emptyWarning?.message).toContain("1 page(s)");
    });
  });

  // ─── Source resolution ────────────────────────────────────────────────

  describe("source resolution", () => {
    it("handles storage_path source by downloading from Supabase", async () => {
      mockFetch.mockResolvedValue(jsonResponse(makePaddleResponse()));

      const result = await adapter.extract(
        makeRequest({
          source: {
            type: "storage_path",
            bucket: "underwriting-guides",
            path: "imo-1/guide.pdf",
          },
        }),
      );

      expect(mockFrom).toHaveBeenCalledWith("underwriting-guides");
      expect(mockDownload).toHaveBeenCalledWith("imo-1/guide.pdf");
      expect(result.documentId).toBe("doc-paddle-1");
    });

    it("handles signed_url source by fetching", async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response(new Blob(["pdf-data"]), { status: 200 }),
        )
        .mockResolvedValueOnce(jsonResponse(makePaddleResponse()));

      const result = await adapter.extract(
        makeRequest({
          source: { type: "signed_url", url: "https://example.com/file.pdf" },
        }),
      );

      expect(result.documentId).toBe("doc-paddle-1");
    });
  });
});
