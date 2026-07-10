# Localization research candidate status

Two bounded research lanes produced ten KR→US and ten US→KR public-website audit candidates with source URLs, captured text, screenshots, timestamps, hashes, issue tags, graph relationships, and promotion gates. The working evidence remains under ignored `work/research/` paths because it is not yet a reviewed golden dataset.

Strong KR→US examples include residual Korean UI on English pages, semantic drift, accessibility-copy defects, and weak US value propositions. Strong US→KR examples include untranslated banners, unnatural CTAs, unresolved Korean morphology placeholders, missing particles, and headline rhythm failures.

Every record is intentionally marked `CANDIDATE_UNREVIEWED` or `RESEARCH_ONLY`. No model-generated diagnosis has been promoted to the six-record canonical corpus. Promotion requires bilingual review, a screenshot that visibly contains the issue, source/target recapture, immutable IDs, and a new dataset version.

## gbrain and Convex decision

The installed gbrain `0.36.3.0` supports PGLite and Postgres/Supabase engines, not Convex. Its SQL-shaped `BrainEngine` is too broad to port during the buildathon. The demo therefore keeps:

- the reviewed, read-only three-tool KB contract (`search`, `query`, `get_page`);
- deterministic keyword fallback and an optional isolated PGLite import;
- Convex reserved for product audit/run/payment state;
- Cloudflare R2 reserved for screenshot and HTML artifacts.

A post-hackathon Convex retrieval projection is feasible, but it would be a nativas-specific immutable record/chunk/vector adapter—not gbrain running on Convex. The projection must preserve the same three bounded Hermes-facing tools and keep screenshot bytes in R2.

The full evidence and architecture audit are retained locally at `work/research/gbrain-convex-audit.md` for review before any corpus promotion.
