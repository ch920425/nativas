import assert from "node:assert/strict";
import test from "node:test";
import { selectPaidPagePairs } from "../../apps/local-server/src/discovery.ts";

test("PDISC-01 selects two highest-value distinct roles with stable tie-breaking", () => {
  const common = { auditId: "paid_1", direction: "KR_TO_US" as const, homepageUrls: ["https://acme.com/ko", "https://acme.com/en"] as [string, string], verifiedHosts: ["acme.com"] };
  const links = [
    { href: "https://acme.com/ko/features", counterpartHref: "https://acme.com/en/features", counterpartMethod: "HREFLANG" as const, inPrimaryNavigation: true },
    { href: "https://acme.com/ko/pricing", counterpartHref: "https://acme.com/en/pricing", counterpartMethod: "HREFLANG" as const },
    { href: "https://acme.com/ko/product", counterpartHref: "https://acme.com/en/product", counterpartMethod: "LANGUAGE_SWITCH" as const },
  ];
  const selected = selectPaidPagePairs({ ...common, links });
  assert.deepEqual(selected.map((pair) => pair.role), ["FEATURES", "PRICING"]);
  assert.deepEqual(selectPaidPagePairs({ ...common, links: [...links].reverse() }), selected);
});

test("PDISC-01 supports one pair and never repeats either homepage", () => {
  const selected = selectPaidPagePairs({
    auditId: "paid_1", direction: "US_TO_KR", homepageUrls: ["https://acme.com/en", "https://acme.com/ko"], verifiedHosts: ["acme.com"],
    links: [
      { href: "https://acme.com/en", counterpartHref: "https://acme.com/ko", counterpartMethod: "HREFLANG" },
      { href: "https://acme.com/en/docs", counterpartHref: "https://acme.com/ko/docs", counterpartMethod: "LOCALE_PATTERN" },
    ],
  });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].role, "DOCUMENTATION");
});

test("PDISC-02 rejects missing locale proof, excluded/auth URLs, assets, ports, IP literals, and cross-domain pairs", () => {
  const selected = selectPaidPagePairs({
    auditId: "paid_1", direction: "KR_TO_US", homepageUrls: ["https://acme.com/ko", "https://acme.com/en"], verifiedHosts: ["acme.com"],
    links: [
      { href: "https://acme.com/ko/product" },
      { href: "https://acme.com/ko/login", counterpartHref: "https://acme.com/en/login", counterpartMethod: "HREFLANG" },
      { href: "https://acme.com/ko/file.pdf", counterpartHref: "https://acme.com/en/file.pdf", counterpartMethod: "HREFLANG" },
      { href: "https://acme.com:8443/ko/pricing", counterpartHref: "https://acme.com/en/pricing", counterpartMethod: "HREFLANG" },
      { href: "https://127.0.0.1/ko/pricing", counterpartHref: "https://127.0.0.1/en/pricing", counterpartMethod: "HREFLANG" },
      { href: "https://acme.com/ko/pricing", counterpartHref: "https://evil.test/en/pricing", counterpartMethod: "HREFLANG" },
    ],
  });
  assert.deepEqual(selected, []);
});

test("PDISC-01 canonicalizes tracking variants, deduplicates pairs, and prefers role diversity", () => {
  const selected = selectPaidPagePairs({
    auditId: "paid_1", direction: "KR_TO_US", homepageUrls: ["https://acme.com/ko/", "https://acme.com/en/"], verifiedHosts: ["acme.com"],
    links: [
      { href: "https://acme.com/ko/features?utm_source=x", counterpartHref: "https://acme.com/en/features?utm_source=x", counterpartMethod: "HREFLANG", inPrimaryNavigation: true },
      { href: "https://acme.com/ko/features?utm_source=y", counterpartHref: "https://acme.com/en/features?utm_source=y", counterpartMethod: "HREFLANG" },
      { href: "https://acme.com/ko/product", counterpartHref: "https://acme.com/en/product", counterpartMethod: "LANGUAGE_SWITCH" },
      { href: "https://acme.com/ko/solutions/industry/team/large", counterpartHref: "https://acme.com/en/solutions/industry/team/large", counterpartMethod: "LOCALE_PATTERN" },
    ],
  });
  assert.equal(selected.length, 2);
  assert.equal(new Set(selected.map((pair) => pair.role)).size, 2);
  assert.ok(selected.every((pair) => !pair.sourceUrl.includes("utm_")));
});
