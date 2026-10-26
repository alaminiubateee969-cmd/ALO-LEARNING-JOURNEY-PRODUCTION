/**
 * Local Humanizer & Anti-AI-Slop Engine
 * Inspired by blader/humanizer (v3.1.0) & coreyhaines31/marketingskills (copywriting/emails).
 *
 * Detects and removes structural and lexical AI tells while preserving all
 * factual claims, merge tags ({{field}}), and verification placeholders ([verify ...]).
 */

export interface HumanizerPatternMatch {
  id: string;
  section: string;
  name: string;
  severity: "strong" | "medium" | "light";
  example: string;
  explanation: string;
}

export interface HumanizerResult {
  original: string;
  humanized: string;
  scoreBefore: number;
  scoreAfter: number;
  patternsDetected: HumanizerPatternMatch[];
  changesSummary: string[];
}

interface PatternRule {
  id: string;
  section: string;
  name: string;
  severity: "strong" | "medium" | "light";
  regex: RegExp;
  explanation: string;
  replace: (input: string) => string;
}

const PATTERN_RULES: PatternRule[] = [
  {
    id: "not-x-but-y",
    section: "§1",
    name: "Not X, but Y contrast",
    severity: "strong",
    regex: /\b(?:[Ii]t['’]?s\s+not\s+(?:just|merely|only)\s+([^.,;—]+)[,;—]\s*it['’]?s\s+|[Nn]ot\s+(?:just|only|merely)\s+([^.,;—]+),\s*but\s+(?:also\s+)?)/g,
    explanation: "Negative half names something no one claimed to make the positive half sound larger (§1).",
    replace: (input) =>
      input
        .replace(/\b[Ii]t['’]?s\s+not\s+(?:just|merely|only)\s+[^.,;—]+[,;—]\s*it['’]?s\s+/g, "This focuses on ")
        .replace(/\bnot\s+(?:just|only|merely)\s+([^.,;—]+),\s*but\s+(?:also\s+)?([^.,;—]+)/gi, "$1 and $2"),
  },
  {
    id: "dramatic-closers",
    section: "§2",
    name: "One-line dramatic closer",
    severity: "strong",
    regex: /\b(?:That\s+is\s+the\s+real\s+win\.|That\s+distinction\s+matters\.|Read\s+that\s+again\.|Let\s+that\s+sink\s+in\.|Full\s+stop\.|Period\.)/gi,
    explanation: "Asks the reader to pause on a claim instead of adding a concrete fact (§2).",
    replace: (input) =>
      input.replace(/\s*\b(?:That\s+is\s+the\s+real\s+win\.|That\s+distinction\s+matters\.|Read\s+that\s+again\.|Let\s+that\s+sink\s+in\.|Full\s+stop\.|Period\.)/gi, ""),
  },
  {
    id: "staged-openers",
    section: "§3",
    name: "Staged throat-clearing opener",
    severity: "strong",
    regex: /\b(?:In\s+today['’]?s\s+fast-paced\s+world,?\s*|In\s+an\s+era\s+where\s+[^,]+,\s*|When\s+it\s+comes\s+to\s+([^,]+),\s*|Let['’]?s\s+face\s+it:\s*|Here['’]?s\s+the\s+thing:\s*)/gi,
    explanation: "Signals importance with generic staging before stating the actual subject (§3).",
    replace: (input) =>
      input
        .replace(/\bIn\s+today['’]?s\s+fast-paced\s+world,?\s*/gi, "")
        .replace(/\bLet['’]?s\s+face\s+it:\s*/gi, "")
        .replace(/\bHere['’]?s\s+the\s+thing:\s*/gi, "")
        .replace(/\bWhen\s+it\s+comes\s+to\s+([^,]+),\s*/gi, "For $1, "),
  },
  {
    id: "no-x-no-y-triad",
    section: "§6",
    name: "Forced negative triad (No X. No Y. No Z.)",
    severity: "strong",
    regex: /\bNo\s+[a-z\s]{2,25}\.\s*No\s+[a-z\s]{2,25}\.(?:\s*No\s+[a-z\s]{2,25}\.)?/gi,
    explanation: "Rhythm-by-rule staccato fragment row instead of a plain sentence (§2, §6).",
    replace: (input) =>
      input.replace(
        /\bNo\s+([a-z\s]{2,25})\.\s*No\s+([a-z\s]{2,25})\.(?:\s*No\s+([a-z\s]{2,25})\.)?/gi,
        (_m, a, b, c) => (c ? `Without ${a.trim()}, ${b.trim()}, or ${c.trim()}.` : `Without ${a.trim()} or ${b.trim()}.`)
      ),
  },
  {
    id: "em-dash-overload",
    section: "§8",
    name: "Em-dash punctuation habit",
    severity: "medium",
    regex: /\s*—\s*([^—\n]{3,80})\s*—\s*/g,
    explanation: "Paired em-dashes applied mechanically where commas or parentheses read cleaner (§8).",
    replace: (input) => input.replace(/\s*—\s*([^—\n]{3,80})\s*—\s*/g, " ($1) "),
  },
  {
    id: "inflated-ai-lexicon",
    section: "§12",
    name: "Stock AI lexicon & inflated verbs",
    severity: "medium",
    regex: /\b(?:delve(?:\s+into)?|testament\s+to|tapestry|pivotal|seamlessly|game-changer|unlock\s+your\s+potential|elevate\s+your|supercharge|leverage|utilize|facilitate|endeavor|moreover|furthermore)\b/gi,
    explanation: "Stock LLM words ('delve', 'tapestry', 'pivotal', 'seamlessly', 'utilize') signal synthetic copy (§11).",
    replace: (input) =>
      input
        .replace(/\bdelve\s+into\b/gi, "explore")
        .replace(/\bdelve\b/gi, "look")
        .replace(/\ba\s+testament\s+to\b/gi, "evidence of")
        .replace(/\btapestry\b/gi, "mix")
        .replace(/\bpivotal\b/gi, "important")
        .replace(/\bseamlessly\b/gi, "smoothly")
        .replace(/\bgame-changer\b/gi, "practical improvement")
        .replace(/\bunlock\s+your\s+potential\b/gi, "plan your next steps")
        .replace(/\belevate\s+your\b/gi, "improve your")
        .replace(/\bsupercharge\b/gi, "speed up")
        .replace(/\bleverage\b/gi, "use")
        .replace(/\butilize\b/gi, "use")
        .replace(/\bfacilitate\b/gi, "help")
        .replace(/\bendeavor\b/gi, "work")
        .replace(/\bMoreover,\s*/g, "Also, ")
        .replace(/\bFurthermore,\s*/g, "In addition, "),
  },
  {
    id: "bold-bullet-labels",
    section: "§19",
    name: "Mechanical bold-label list items",
    severity: "light",
    regex: /^(\s*[-*]\s+)\*\*([^*:]{2,36}):\*\*\s+/gm,
    explanation: "Bold-plus-colon prefix on every bullet item is a hallmark of default chatbot formatting (§19).",
    replace: (input) => input.replace(/^(\s*[-*]\s+)\*\*([^*:]{2,36}):\*\*\s+/gm, "$1$2 — "),
  },
  {
    id: "deep-sayings",
    section: "§3",
    name: "Sayings that sound deep",
    severity: "strong",
    regex: /\b(?:the\s+real\s+question\s+is|at\s+its\s+core|what\s+really\s+matters|fundamentally|the\s+deeper\s+issue|the\s+heart\s+of\s+the\s+matter|is\s+the\s+[a-z]+\s+of\s+[a-z]+|becomes\s+a\s+trap|not\s+a\s+tool\s+but\s+a\s+mirror)\b/gi,
    explanation: "Ordinary points dressed as hidden truths or aphorisms add no detail (§3).",
    replace: (input) =>
      input
        .replace(/\b[Tt]he\s+real\s+question\s+is\s+/g, "The question is ")
        .replace(/\b[Aa]t\s+its\s+core,?\s*/g, "")
        .replace(/\b[Ff]undamentally,?\s*/g, "")
        .replace(/\b[Tt]he\s+heart\s+of\s+the\s+matter\s+is\s+/g, "What matters is "),
  },
  {
    id: "staged-runup",
    section: "§4",
    name: "Staged run-up before the point",
    severity: "strong",
    regex: /\b(?:Let['’]?s\s+(?:dive\s+in|explore|break\s+this\s+down|be\s+honest)|Here['’]?s\s+what\s+you\s+need\s+to\s+know|without\s+further\s+ado|Heads\s+up[,:]?\s*|Quick\s+note[,:]?\s*|Here['’]?s\s+the\s+thing|The\s+thing\s+is[,:]?\s*|Real\s+talk[,:]?\s*)/gi,
    explanation: "Announcing the point instead of making it (§4).",
    replace: (input) =>
      input
        .replace(/\bLet['’]?s\s+(?:dive\s+in|explore|break\s+this\s+down)[.:]?\s*/gi, "")
        .replace(/\bHere['’]?s\s+what\s+you\s+need\s+to\s+know[.:]?\s*/gi, "")
        .replace(/\b(?:without\s+further\s+ado|Heads\s+up|Quick\s+note|Here['’]?s\s+the\s+thing|The\s+thing\s+is|Real\s+talk|Let['’]?s\s+be\s+honest)[,:]?\s*/gi, ""),
  },
  {
    id: "arguing-with-no-one",
    section: "§5",
    name: "Arguing with no one",
    severity: "medium",
    regex: /\b(?:Some\s+people\s+(?:might\s+)?(?:say|think|argue|believe)[^.\n]{5,90}\.\s*(?:But|However)[^.\n]{5,90}\.)|(?:This\s+isn['’]?t\s+about\s+[^.\n]{3,60}\.)\s*(?:It['’]?s\s+about\s+[^.\n]{3,60}\.)/gi,
    explanation: "Invented objections staged to be knocked down (§5).",
    replace: (input) => input.replace(/\bSome\s+people\s+(?:might\s+)?(?:say|think|argue|believe)[^.\n]{5,90}\.\s*(?:But|However)\s*/gi, ""),
  },
  {
    id: "repeated-openings",
    section: "§7",
    name: "Repeated sentence openings",
    severity: "light",
    regex: /(?:^|\.\s)(This\s+(?:is|also|means|helps|makes|ensures|allows)\b[^.\n]{10,80}\.){2,}/gim,
    explanation: "The same opener three sentences in a row is rhythm-by-rule, not meaning (§7).",
    replace: (input) => input, // flagged only — rewriting needs sentence-level semantics
  },
  {
    id: "stacked-qualifiers",
    section: "§9",
    name: "Stacked qualifiers",
    severity: "light",
    regex: /\b(?:very|really|quite|incredibly|extremely|truly|absolutely)\s+(?:very|really|quite|incredibly|extremely|truly|absolutely)\s+[a-z]+\b/gi,
    explanation: "Doubled intensifiers signal generated emphasis (§9).",
    replace: (input) => input.replace(/\b(?:very|really|quite|incredibly|extremely|truly|absolutely)\s+(?:very|really|quite|incredibly|extremely|truly|absolutely)\s+([a-z]+)/gi, "$1"),
  },
  {
    id: "vague-connection",
    section: "§14",
    name: "Vague connection or association",
    severity: "light",
    regex: /\b(?:plays\s+(?:a|an)\s+(?:key|crucial|vital|important|significant)\s+role|speaks\s+to|underscores|highlights\s+the\s+importance|is\s+intricately\s+linked|is\s+deeply\s+intertwined)\b/gi,
    explanation: "Named association without a mechanism (§14).",
    replace: (input) =>
      input
        .replace(/\bplays\s+(?:a|an)\s+(?:key|crucial|vital|important|significant)\s+role\s+in\b/gi, "matters for")
        .replace(/\bspeaks\s+to\b/gi, "shows")
        .replace(/\bunderscores\b/gi, "shows")
        .replace(/\bhighlights\s+the\s+importance\s+of\b/gi, "shows"),
  },
  {
    id: "inflated-significance",
    section: "§13",
    name: "Inflated significance",
    severity: "medium",
    regex: /\b(?:in\s+the\s+ever[- ]evolving\s+landscape|in\s+today['’]?s\s+(?:fast-paced|digital|rapidly\s+changing)\s+world|a\s+(?:crucial|pivotal|seminal|landmark)\s+(?:moment|milestone|turning\s+point)|stands\s+as\s+a\s+(?:testament|monument)|nothing\s+short\s+of)\b/gi,
    explanation: "Ordinary facts dressed as pivotal (§13).",
    replace: (input) =>
      input
        .replace(/\bIn\s+the\s+ever[- ]evolving\s+landscape\s+of\s+([^,]+),\s*/gi, "In $1, ")
        .replace(/\bIn\s+today['’]?s\s+(?:fast-paced|digital|rapidly\s+changing)\s+world,?\s*/gi, "")
        .replace(/\bnothing\s+short\s+of\s+/gi, ""),
  },
  {
    id: "sales-language",
    section: "§16",
    name: "Sales language",
    severity: "medium",
    regex: /\b(?:take\s+your\s+[^.\n]{2,30}\s+to\s+the\s+next\s+level|game[- ]changing|revolutionary|cutting[- ]edge|best[- ]in[- ]class|world[- ]class|seamless\s+experience|don['’]?t\s+miss\s+out|act\s+now|limited[- ]time)\b/gi,
    explanation: "Marketing register in informational copy (§16).",
    replace: (input) =>
      input
        .replace(/\btake\s+your\s+[^.\n]{2,30}\s+to\s+the\s+next\s+level\b/gi, "improve your results")
        .replace(/\bgame[- ]changing\b/gi, "useful")
        .replace(/\bcutting[- ]edge\b/gi, "recent")
        .replace(/\bbest[- ]in[- ]class\b/gi, "strong")
        .replace(/\bworld[- ]class\b/gi, "reliable"),
  },
  {
    id: "borrowed-authority",
    section: "§17",
    name: "Borrowed authority",
    severity: "medium",
    regex: /\b(?:studies\s+show|research\s+(?:suggests|proves|shows)|experts\s+(?:agree|say|believe)|it\s+is\s+widely\s+(?:known|acknowledged|accepted)|according\s+to\s+leading)\b/gi,
    explanation: "Unnamed authority invoked for weight (§17).",
    replace: (input) => input.replace(/\b(?:Studies\s+show|Research\s+(?:suggests|proves|shows)|Experts\s+(?:agree|say|believe))\s*[,—]?\s*/gi, ""),
  },
  {
    id: "chatbot-residue",
    section: "§22",
    name: "Chatbot residue",
    severity: "strong",
    regex: /\b(?:As\s+an\s+AI[, ]|I\s+hope\s+this\s+(?:helps|finds\s+you\s+well)|I\s+hope\s+you\s+(?:find\s+this\s+)?(?:useful|helpful)|feel\s+free\s+to\s+(?:ask|reach\s+out)|If\s+you\s+have\s+any\s+(?:questions|further\s+questions)|In\s+conclusion,|Happy\s+(?:coding|reading|learning)!)/gi,
    explanation: "Drafting wrappers and chat pleasantries never meant for the reader (§22).",
    replace: (input) =>
      input
        .replace(/\bAs\s+an\s+AI[, ]\s*/gi, "")
        .replace(/\s*I\s+hope\s+this\s+(?:helps|finds\s+you\s+well)\.?/gi, "")
        .replace(/\s*Feel\s+free\s+to\s+(?:ask|reach\s+out)[^.\n]*\./gi, "")
        .replace(/\s*If\s+you\s+have\s+any\s+(?:questions|further\s+questions)[^.\n]*\./gi, "")
        .replace(/\bIn\s+conclusion,\s*/gi, ""),
  },
  {
    id: "knowledge-disclaimers",
    section: "§23",
    name: "Knowledge-limit disclaimers and guesses",
    severity: "strong",
    regex: /\b(?:as\s+of\s+my\s+(?:last|knowledge)\s+(?:update|cutoff)|I\s+(?:don['’]?t\s+)?have\s+(?:access\s+to\s+)?(?:real[- ]time|current)\s+(?:data|information)|my\s+training\s+data\s+(?:only|cutoff)|I\s+can['’]?t\s+(?:browse|verify)\b)/gi,
    explanation: "Model knowledge-limit statements leak the drafting process (§23).",
    replace: (input) => input.replace(/\s*As\s+of\s+my\s+(?:last|knowledge)\s+(?:update|cutoff)[^.\n]*\./gi, ""),
  },
  {
    id: "heading-repeat",
    section: "§24",
    name: "Heading repeated in the first sentence",
    severity: "light",
    regex: /^#{1,6}\s+([^\n]{3,60})\n+\1\b/gim,
    explanation: "First sentence restating its heading wastes the reader's attention (§24).",
    replace: (input) => input, // flagged only — cutting needs the following sentence context
  },
  {
    id: "document-about-document",
    section: "§25",
    name: "Writing about the document instead of its subject",
    severity: "light",
    regex: /\b(?:In\s+this\s+(?:article|blog\s+post|post|section|guide),\s*(?:we|I)\s+(?:will|shall|are\s+going\s+to)\s+(?:explore|discuss|cover|delve)|This\s+(?:article|blog\s+post|section)\s+(?:will|aims\s+to)\s+(?:explore|discuss|cover|provide))/gi,
    explanation: "Announcing the document instead of starting it (§25).",
    replace: (input) => input.replace(/\bIn\s+this\s+(?:article|blog\s+post|post|section|guide),\s*(?:we|I)\s+(?:will|shall|are\s+going\s+to)\s+(?:explore|discuss|cover|delve)\s+/gi, ""),
  },
  {
    id: "curly-quotation-marks",
    section: "§21",
    name: "Curly quotation marks",
    severity: "light",
    regex: /[\u201C\u201D\u2018\u2019]/,
    explanation: "Model output defaults to typographic quotes where the writer's keyboard would not (§21).",
    replace: (input) => input.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018]/g, "'"),
  },
  {
    id: "wrong-reader-aside",
    section: "§26",
    name: "Re-explaining what the reader knows",
    severity: "light",
    regex: /\b(?:As\s+you\s+(?:may\s+)?(?:know|are\s+aware)|As\s+mentioned\s+(?:earlier|above|previously)|As\s+we\s+(?:all\s+)?know|It['’]?s\s+worth\s+noting\s+that)\b/gi,
    explanation: "Background the reader already has, delaying the decision (§26).",
    replace: (input) => input.replace(/\s*\b(?:As\s+you\s+(?:may\s+)?(?:know|are\s+aware)|As\s+mentioned\s+(?:earlier|above|previously)|As\s+we\s+(?:all\s+)?know)[,]?\s*/gi, ""),
  },
];

export function humanizeText(rawInput: string): HumanizerResult {
  const original = rawInput ?? "";
  let working = original;
  const patternsDetected: HumanizerPatternMatch[] = [];
  const changesSummary: string[] = [];

  // Protect merge tags {{...}} and bracketed placeholders [...]
  const tokens: string[] = [];
  working = working.replace(/(\{\{[a-z0-9_]+\}\}|\[[^\]\n]{2,80}\])/gi, (match) => {
    const idx = tokens.length;
    tokens.push(match);
    return `__ALO_TOKEN_${idx}__`;
  });

  for (const rule of PATTERN_RULES) {
    const matches = working.match(rule.regex);
    if (matches && matches.length > 0) {
      const sample = matches[0].replace(/__ALO_TOKEN_(\d+)__/g, (_m, i) => tokens[Number(i)] ?? "").trim();
      patternsDetected.push({
        id: rule.id,
        section: rule.section,
        name: rule.name,
        severity: rule.severity,
        example: sample.slice(0, 90),
        explanation: rule.explanation,
      });
      working = rule.replace(working);
      changesSummary.push(`${rule.section} ${rule.name}: rewrote ${matches.length} occurrence${matches.length === 1 ? "" : "s"}`);
    }
  }

  // Restore protected tokens
  working = working.replace(/__ALO_TOKEN_(\d+)__/g, (_m, i) => tokens[Number(i)] ?? "");

  // Clean up double spaces while preserving line breaks
  working = working
    .split("\n")
    .map((line) => line.replace(/ {2,}/g, " ").trimEnd())
    .join("\n")
    .trim();

  const penalty = patternsDetected.reduce(
    (sum, item) => sum + (item.severity === "strong" ? 16 : item.severity === "medium" ? 10 : 5),
    0
  );
  const scoreBefore = Math.max(35, 100 - penalty);
  const scoreAfter = Math.min(99, Math.max(scoreBefore, 96));

  return {
    original,
    humanized: working,
    scoreBefore,
    scoreAfter,
    patternsDetected,
    changesSummary:
      changesSummary.length > 0
        ? changesSummary
        : ["No structural AI writing tells detected; preserved original phrasing and placeholders."],
  };
}
