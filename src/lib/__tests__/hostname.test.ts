import { describe, it, expect } from "vitest";
import {
  classifyHost,
  getPlatformSubdomainSlug,
  isPrimaryHost,
  isVercelPreview,
} from "../hostname";

describe("getPlatformSubdomainSlug", () => {
  it("returns the slug for a valid branded subdomain", () => {
    expect(getPlatformSubdomainSlug("joe-agent.thestandardhq.com")).toBe(
      "joe-agent",
    );
    expect(getPlatformSubdomainSlug("the-standard.thestandardhq.com")).toBe(
      "the-standard",
    );
  });

  it("is case-insensitive", () => {
    expect(getPlatformSubdomainSlug("Joe-Agent.TheStandardHQ.com")).toBe(
      "joe-agent",
    );
  });

  it("returns null for the apex and www", () => {
    expect(getPlatformSubdomainSlug("thestandardhq.com")).toBeNull();
    expect(getPlatformSubdomainSlug("www.thestandardhq.com")).toBeNull();
  });

  it("returns null for reserved labels", () => {
    for (const label of ["app", "api", "admin", "mail", "auth", "cdn"]) {
      expect(getPlatformSubdomainSlug(`${label}.thestandardhq.com`)).toBeNull();
    }
  });

  it("returns null for deeper nests (not a single label)", () => {
    expect(getPlatformSubdomainSlug("a.b.thestandardhq.com")).toBeNull();
  });

  it("returns null for hosts that are not subdomains of the apex", () => {
    expect(getPlatformSubdomainSlug("join.theiragency.com")).toBeNull();
    expect(getPlatformSubdomainSlug("notthestandardhq.com")).toBeNull();
    expect(getPlatformSubdomainSlug("localhost")).toBeNull();
  });

  it("returns null for slugs that violate the recruiter_slug format", () => {
    expect(getPlatformSubdomainSlug("ab.thestandardhq.com")).toBeNull(); // too short (<3)
    expect(getPlatformSubdomainSlug("-joe.thestandardhq.com")).toBeNull(); // leading hyphen
    expect(getPlatformSubdomainSlug("joe-.thestandardhq.com")).toBeNull(); // trailing hyphen
    expect(getPlatformSubdomainSlug("joe_agent.thestandardhq.com")).toBeNull(); // underscore
  });
});

describe("isVercelPreview / isPrimaryHost", () => {
  it("treats vercel previews as primary", () => {
    expect(isVercelPreview("commission-tracker-abc123.vercel.app")).toBe(true);
    expect(isPrimaryHost("commission-tracker-abc123.vercel.app")).toBe(true);
  });

  it("treats the apex, www and localhost as primary", () => {
    expect(isPrimaryHost("thestandardhq.com")).toBe(true);
    expect(isPrimaryHost("www.thestandardhq.com")).toBe(true);
    expect(isPrimaryHost("localhost")).toBe(true);
    expect(isPrimaryHost("127.0.0.1")).toBe(true);
  });

  it("does not treat a branded subdomain as primary", () => {
    expect(isPrimaryHost("joe.thestandardhq.com")).toBe(false);
  });
});

describe("classifyHost", () => {
  it("classifies primary hosts", () => {
    expect(classifyHost("thestandardhq.com")).toEqual({ kind: "primary" });
    expect(classifyHost("www.thestandardhq.com")).toEqual({ kind: "primary" });
    expect(classifyHost("localhost")).toEqual({ kind: "primary" });
    expect(classifyHost("foo.vercel.app")).toEqual({ kind: "primary" });
    expect(classifyHost("")).toEqual({ kind: "primary" });
  });

  it("classifies branded platform subdomains", () => {
    expect(classifyHost("joe-agent.thestandardhq.com")).toEqual({
      kind: "platform-subdomain",
      slug: "joe-agent",
    });
  });

  it("treats reserved/invalid platform subdomains as primary (not custom)", () => {
    expect(classifyHost("app.thestandardhq.com")).toEqual({ kind: "primary" });
    expect(classifyHost("a.b.thestandardhq.com")).toEqual({ kind: "primary" });
    expect(classifyHost("ab.thestandardhq.com")).toEqual({ kind: "primary" });
  });

  it("classifies external white-label domains as custom", () => {
    expect(classifyHost("join.theiragency.com")).toEqual({ kind: "custom" });
    expect(classifyHost("recruit.example.org")).toEqual({ kind: "custom" });
  });
});
