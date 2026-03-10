// /home/nneessen/projects/commissionTracker/src/setupTests.ts
import "@testing-library/jest-dom";
import { vi } from "vitest";

// Extend the global object with test-specific properties
declare global {
  interface Window {
    matchMedia: (query: string) => MediaQueryList;
  }
}

// Mock matchMedia for components that use media queries
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}

// Mock IntersectionObserver
if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = class IntersectionObserver {
    root = null;
    rootMargin = "";
    thresholds = [];

    constructor() {}
    observe() {
      return null;
    }
    disconnect() {
      return null;
    }
    unobserve() {
      return null;
    }
    takeRecords() {
      return [];
    }
  };
}

// Mock uuid module for Vitest
vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-uuid-" + Math.random().toString(36).substr(2, 9)),
}));

// Mock environment variables for tests
process.env.VITE_USE_LOCAL = "true";
process.env.VITE_API_URL = "http://localhost:3001";
