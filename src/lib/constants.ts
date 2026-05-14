export const SITE_NAME = "Hermes";
export const SITE_TAGLINE = "News, synthesized.";
export const SITE_NAMEPLATE_SUB = "Journal Trader Intelligence";

export const SECTIONS = [
  { slug: "/", label: "Front Page" },
  { slug: "/section/world", label: "World" },
  { slug: "/section/us", label: "U.S." },
  { slug: "/section/business", label: "Business" },
  { slug: "/section/markets", label: "Markets" },
  { slug: "/section/tech", label: "Tech" },
  { slug: "/section/culture", label: "Culture" },
  { slug: "/how-it-works", label: "How It Works" },
] as const;

export const COMPILE_MODES = [
  {
    value: "freeform",
    label: "Ask Hermes — describe what you want to know",
    hint: "Ask anything. Hermes will find relevant articles, bridge topics, and surface correlations and disagreements.",
    placeholder:
      "e.g., How do Strait of Hormuz tensions relate to energy stocks? Compare Fed policy with ECB moves this quarter.",
    input: "text" as const,
    showSourcePicker: false,
  },
  {
    value: "topic",
    label: "By Topic — find every outlet covering an event",
    hint: "Hermes will search the past 72 hours of whitelisted reporting for this topic and compile one story.",
    placeholder:
      "e.g., Federal Reserve rate decision, OpenAI copyright suit, Tokyo G7 summit",
    input: "text" as const,
    showSourcePicker: false,
  },
  {
    value: "links",
    label: "By Links — paste article URLs to compile",
    hint: "Paste at least two article URLs. Hermes will reject any link that is not from a whitelisted outlet, then compile a story from the remainder.",
    placeholder:
      "Paste 2 or more article URLs from whitelisted outlets, one per line.\n\nhttps://www.reuters.com/world/...\nhttps://apnews.com/article/...\nhttps://www.bbc.com/news/...",
    input: "textarea" as const,
    showSourcePicker: false,
  },
  {
    value: "headline",
    label: "By Headline — match an exact headline cluster",
    hint: "Paste an exact headline. Hermes will match it to an existing topic cluster (or create one) and compile from every outlet in that cluster.",
    placeholder: 'e.g., "Fed holds rates steady, signals patience on cuts"',
    input: "text" as const,
    showSourcePicker: false,
  },
  {
    value: "compare",
    label: "Compare Sources — pick a topic and outlets",
    hint: "Pick a topic and the outlets you want to compare. Hermes will compile a story drawn only from your selected outlets and surface where they disagree.",
    placeholder: "e.g., G7 foreign ministers meeting",
    input: "text" as const,
    showSourcePicker: true,
  },
] as const;

export type CompileMode = (typeof COMPILE_MODES)[number]["value"];

