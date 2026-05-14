# Test fixtures

The synthesis prompt and ingestion pipeline are tested against fixture
clusters that mirror the six categories in `PROMPT_DESIGN.md`:

| Cluster | Purpose |
|---------|---------|
| high-coverage breaking news | rich synthesis, multiple disagreements, no hallucinated facts |
| earnings report | precise numerical agreement and clean attribution |
| contested political event | surfaced framing differences |
| underreported story | prominent single-source flagging |
| opinion-heavy cluster | low-confidence, refused synthesis |
| same outlet, multiple updates | timeline-aware synthesis |

Fixtures live under:

- `feeds/` — sample RSS XML
- `articles/` — sample article HTML (post-Readability text)
- `llm-responses/` — pre-recorded LLM outputs for replay tests

Fixture-driven LLM tests use the recorded responses by default; set
`VERITY_LLM_LIVE=1` to re-record against the real provider (costs real money).
