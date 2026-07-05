/* =========================================================================
   ai.js
   Phase 5 — real AI generation via the Claude API, called directly from
   the browser. This is the "no backend" option Anthropic documents for
   exactly this use case: internal tools run by a trusted user on their
   own machine. It requires two things, both set in Settings:
     - an API key from console.anthropic.com (billed separately from any
       claude.ai subscription; a new account gets a small one-time trial
       credit)
     - a model id (Haiku 4.5 by default — cheap and plenty capable for
       short business writing; Sonnet 5 is offered for richer output)

   Security note (worth remembering, not just for us but for anyone who
   maintains this app later): the API key lives in this browser's
   IndexedDB and is sent with every request. Anyone with access to this
   browser profile can read it. That's an acceptable tradeoff for a
   single-user local tool; it would NOT be for something shared or
   deployed publicly.
   ========================================================================= */

const AI = (function () {
  "use strict";

  const API_URL = "https://api.anthropic.com/v1/messages";
  const API_VERSION = "2023-06-01";
  const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

  const WORK_AREAS = [
    "1. Facility Improvement",
    "2. System Improvement",
    "3. Process Improvement",
    "4. Customer Satisfaction",
    "5. User Improvement",
    "6. Cost saving",
    "7. Co-ordination",
  ];

  const TQM_AREAS = [
    "1. House Keeping (HK)",
    "2. Learning (L)",
    "3. Development",
    "4. Communication",
    "5. Computerization (Comp)",
    "6. Human Relations (HR)",
    "7. Quality improvement",
  ];

  const PLACEHOLDER = {
    before: "[Describe the situation before this improvement — click here and type over this.]",
    problem: "[Describe the specific problem this action addressed.]",
    after: "[Describe the result after this action was taken.]",
    benefits: "[Describe the benefits — time saved, cost reduced, quality improved, etc.]",
  };

  function isConfigured() {
    return !!Settings.getDefaults().apiKey;
  }

  function tidySentence(text) {
    text = (text || "").trim();
    if (!text) return text;
    text = text.charAt(0).toUpperCase() + text.slice(1);
    if (!/[.!?]$/.test(text)) text += ".";
    return text;
  }

  function isPlaceholder(text) {
    return Object.values(PLACEHOLDER).includes(text);
  }

  function deriveTitle(actionText) {
    const words = (actionText || "").replace(/[.\n\r]+$/, "").trim().split(/\s+/).slice(0, 8).join(" ");
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
  }

  /** No API key set: builds a structured starting skeleton with no invented content. */
  function offlineGenerate(actionTaken) {
    return {
      title: deriveTitle(actionTaken),
      before: PLACEHOLDER.before,
      problem: PLACEHOLDER.problem,
      improvedActionTaken: tidySentence(actionTaken),
      after: PLACEHOLDER.after,
      benefits: PLACEHOLDER.benefits,
      workArea: [],
      tqmArea: [],
    };
  }

  /** No API key set: light text cleanup only — capitalization/punctuation, no invented content. */
  function offlineImprove(kaizen) {
    kaizen = kaizen || {};
    return {
      title: (kaizen.title || "").trim(),
      before: isPlaceholder(kaizen.before) ? kaizen.before : tidySentence(kaizen.before),
      problem: isPlaceholder(kaizen.problem) ? kaizen.problem : tidySentence(kaizen.problem),
      improvedActionTaken: tidySentence(kaizen.actionTaken),
      after: isPlaceholder(kaizen.after) ? kaizen.after : tidySentence(kaizen.after),
      benefits: isPlaceholder(kaizen.benefits) ? kaizen.benefits : tidySentence(kaizen.benefits),
      workArea: Array.isArray(kaizen.workArea) ? kaizen.workArea : kaizen.workArea ? [kaizen.workArea] : [],
      tqmArea: Array.isArray(kaizen.tqmArea) ? kaizen.tqmArea : kaizen.tqmArea ? [kaizen.tqmArea] : [],
    };
  }

  // ---------------------------- Low-level call ----------------------------

  function callClaude(apiKey, model, userPrompt, maxTokens) {
    return fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
        "content-type": "application/json",
        // Documented Anthropic opt-in for calling the API directly from a
        // browser (no server proxy). See: console.anthropic.com docs.
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        max_tokens: maxTokens || 800,
        messages: [{ role: "user", content: userPrompt }],
      }),
    }).then((res) =>
      res.json().then((data) => {
        if (!res.ok) {
          const msg = (data && data.error && data.error.message) || "Request failed (HTTP " + res.status + ")";
          throw new Error(msg);
        }
        return data;
      })
    );
  }

  function extractText(apiResponse) {
    const block = apiResponse.content && apiResponse.content.find((b) => b.type === "text");
    return block ? block.text : "";
  }

  /** The model is asked for pure JSON, but strips fences defensively in case it adds them anyway. */
  function parseJsonResponse(text) {
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      throw new Error("The AI response wasn't valid JSON. Try again, or rephrase your input.");
    }
  }

  function sanitizeFields(obj, fallbackActionTaken) {
    obj = obj || {};
    const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
    return {
      title: (obj.title || "").trim(),
      before: (obj.before || "").trim(),
      problem: (obj.problem || "").trim(),
      improvedActionTaken: (obj.improvedActionTaken || fallbackActionTaken || "").trim(),
      after: (obj.after || "").trim(),
      benefits: (obj.benefits || "").trim(),
      workArea: asArray(obj.workArea).filter((v) => WORK_AREAS.includes(v)),
      tqmArea: asArray(obj.tqmArea).filter((v) => TQM_AREAS.includes(v)),
    };
  }

  const RESPONSE_SHAPE = [
    'Respond with ONLY a single JSON object (no markdown fences, no commentary before or after). Use exactly these keys:',
    "{",
    '  "title": "short descriptive title, max ~8 words",',
    '  "before": "1-2 sentences describing the situation before the improvement",',
    '  "problem": "1-2 sentences describing the specific problem",',
    '  "improvedActionTaken": "a polished, professional 1-3 sentence rewrite of the action taken",',
    '  "after": "1-2 sentences describing the resulting situation",',
    '  "benefits": "1-2 sentences describing measurable or qualitative benefits",',
    '  "workArea": "an array of 1-2 strings from this list, most relevant first: ' + JSON.stringify(WORK_AREAS) + '",',
    '  "tqmArea": "an array of 1-2 strings from this list, most relevant first: ' + JSON.stringify(TQM_AREAS) + '"',
    "}",
    "Keep language concise, plain, and professional — this will be printed on a physical A4 report form with limited space per field.",
  ].join("\n");

  // ---------------------------- Public API ----------------------------

  /**
   * Turns a raw "Action Taken" description into a full Kaizen draft.
   * @param {string} actionTaken - mandatory free-text description.
   * @param {{name:string, department:string, month:string, depot:string}} meta
   * @returns {Promise<object>} fields matching the Edit Kaizen form.
   */
  function generateKaizen(actionTaken, meta) {
    meta = meta || {};
    if (!isConfigured()) {
      return Promise.resolve(offlineGenerate(actionTaken));
    }
    return Promise.resolve().then(() => {
      const defaults = Settings.getDefaults();

      const prompt =
        "You are helping an employee at GCMMF (Amul) write a professional Kaizen " +
        "(continuous-improvement) record for internal reporting.\n\n" +
        "Action Taken: " + actionTaken + "\n" +
        "Department: " + (meta.department || "") + "\n" +
        "Depot: " + (meta.depot || "") + "\n\n" +
        RESPONSE_SHAPE;

      return callClaude(defaults.apiKey, defaults.aiModel, prompt, 700)
        .then(extractText)
        .then(parseJsonResponse)
        .then((parsed) => sanitizeFields(parsed, actionTaken));
    });
  }

  /**
   * Takes the current (possibly hand-edited) Kaizen and returns AI-improved
   * versions of its fields.
   * @param {object} kaizen - current form state.
   * @returns {Promise<object>} full field set to apply.
   */
  function improveKaizen(kaizen) {
    kaizen = kaizen || {};
    if (!isConfigured()) {
      return Promise.resolve(offlineImprove(kaizen));
    }
    return Promise.resolve().then(() => {
      const defaults = Settings.getDefaults();

      const prompt =
        "You are helping an employee at GCMMF (Amul) refine a draft Kaizen " +
        "(continuous-improvement) record for internal reporting. Improve the " +
        "clarity, professionalism, and conciseness of the draft below without " +
        "inventing facts that aren't implied by it.\n\n" +
        "Current draft (JSON):\n" + JSON.stringify({
          title: kaizen.title,
          before: kaizen.before,
          problem: kaizen.problem,
          actionTaken: kaizen.actionTaken,
          after: kaizen.after,
          benefits: kaizen.benefits,
          workArea: kaizen.workArea,
          tqmArea: kaizen.tqmArea,
        }, null, 2) + "\n\n" + RESPONSE_SHAPE;

      return callClaude(defaults.apiKey, defaults.aiModel, prompt, 700)
        .then(extractText)
        .then(parseJsonResponse)
        .then((parsed) => sanitizeFields(parsed, kaizen.actionTaken));
    });
  }

  /**
   * Reads a pasted block of raw text (notes, an SOP excerpt, an email
   * thread, etc.) and suggests a handful of distinct Kaizen ideas found in
   * or implied by it. No offline fallback exists for this one — genuinely
   * reading and interpreting free-form text needs a real model, unlike
   * generateKaizen()/improveKaizen() which can fall back to templating.
   * @param {string} pastedText
   * @returns {Promise<Array<{title:string, summary:string, suggestedActionTaken:string}>>}
   */
  function suggestKaizens(pastedText) {
    return Promise.resolve().then(() => {
      if (!isConfigured()) {
        throw new Error("This feature needs a Claude API key — add one in Settings to use it.");
      }
      const defaults = Settings.getDefaults();

      const prompt =
        "You are helping an employee at GCMMF (Amul) find Kaizen (continuous-improvement) " +
        "opportunities inside raw material such as notes, SOP excerpts, email threads, or " +
        "meeting minutes.\n\n" +
        "Read the text below and identify up to 5 distinct, concrete, actionable improvement " +
        "ideas that are either described as already done, or clearly implied as worth doing. " +
        "Do not invent ideas unrelated to the text. If the text contains fewer than 5 genuine " +
        "opportunities, return fewer — quality over quantity.\n\n" +
        "TEXT:\n\"\"\"\n" + pastedText + "\n\"\"\"\n\n" +
        "Respond with ONLY a JSON array (no markdown fences, no commentary), where each item has:\n" +
        "{\n" +
        '  "title": "short descriptive title, max ~8 words",\n' +
        '  "summary": "1-2 sentences explaining why this is a good Kaizen candidate",\n' +
        '  "suggestedActionTaken": "a 1-2 sentence draft of the Action Taken field, ready to paste into a new Kaizen and refine"\n' +
        "}";

      return callClaude(defaults.apiKey, defaults.aiModel, prompt, 1200)
        .then(extractText)
        .then(parseJsonResponse)
        .then((parsed) => {
          const arr = Array.isArray(parsed) ? parsed : [];
          return arr
            .map((item) => ({
              title: ((item && item.title) || "").trim(),
              summary: ((item && item.summary) || "").trim(),
              suggestedActionTaken: ((item && item.suggestedActionTaken) || "").trim(),
            }))
            .filter((item) => item.title || item.suggestedActionTaken);
        });
    });
  }

  return {
    generateKaizen: generateKaizen,
    improveKaizen: improveKaizen,
    suggestKaizens: suggestKaizens,
    isConfigured: isConfigured,
    DEFAULT_MODEL: DEFAULT_MODEL,
  };
})();
