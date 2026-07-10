import { describe, expect, it } from "vitest";
import { validatePublicHttpUrl } from "./validateUrl";

describe("public URL pre-flight", () => {
  it.each([
    "https://example.co.kr",
    "http://example.com/path?x=1",
    "https://sub.domain.example.com",
  ])("accepts public site %s", (url) => {
    expect(validatePublicHttpUrl(url).ok).toBe(true);
  });

  it.each([
    ["not-a-url", "complete URL"],
    ["ftp://example.com", "http(s)"],
    ["javascript:alert(1)", "http(s)"],
    ["https://user:pw@example.com", "credentials"],
    ["https://localhost:3000", "out of scope"],
    ["https://127.0.0.1", "out of scope"],
    ["https://10.1.2.3", "out of scope"],
    ["https://192.168.0.10", "out of scope"],
    ["https://172.16.9.1", "out of scope"],
    ["https://169.254.169.254/latest/meta-data", "out of scope"],
    ["https://internal.local", "out of scope"],
    ["https://intranet", "public website"],
  ])("rejects %s", (url, fragment) => {
    const result = validatePublicHttpUrl(url);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.toLowerCase()).toContain(fragment.toLowerCase());
  });
});
