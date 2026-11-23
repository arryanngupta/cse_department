// backend/src/services/aiProvider.js
//
// Thin abstraction over the text-generation provider, so the assistant's
// retrieval and grounding logic never imports a vendor SDK directly.
//
// The SDK is imported dynamically rather than at module load. That keeps the
// whole backend bootable when the package is not installed and no API key is
// configured — the assistant then runs in retrieval-only mode instead of
// crashing the server on startup.

import dotenv from 'dotenv';

dotenv.config();

const PROVIDER = (process.env.AI_PROVIDER || 'none').toLowerCase();
const MAX_OUTPUT_TOKENS = Number(process.env.AI_MAX_OUTPUT_TOKENS) || 800;
const REQUEST_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 30000;

const DEFAULT_MODELS = {
  anthropic: 'claude-opus-5',
  openai: 'gpt-4o-mini',
  grok: 'grok-4.7',
  // Verified present on a live Groq account via GET /openai/v1/models. Note
  // the model in Groq's own docs example (llama-3.3-70b-versatile) is not
  // available on every account, so it is a poor default.
  groq: 'openai/gpt-oss-120b',
};

/**
 * The key for the configured provider.
 *
 * Grok reads `XAI_API_KEY` (the name xAI's own documentation uses) and falls
 * back to the generic `AI_API_KEY`, so an existing deployment that already
 * sets the generic name keeps working. Resolved per call rather than captured
 * at import so tests can vary it.
 */
const apiKeyFor = (provider) => {
  if (provider === 'grok') {
    return process.env.XAI_API_KEY || process.env.AI_API_KEY || '';
  }
  if (provider === 'groq') {
    return process.env.GROQ_API_KEY || process.env.AI_API_KEY || '';
  }
  return process.env.AI_API_KEY || '';
};

const modelFor = (provider) => {
  if (provider === 'grok') {
    return process.env.XAI_MODEL || process.env.AI_MODEL || DEFAULT_MODELS.grok;
  }
  if (provider === 'groq') {
    return process.env.GROQ_MODEL || process.env.AI_MODEL || DEFAULT_MODELS.groq;
  }
  return process.env.AI_MODEL || DEFAULT_MODELS[provider] || null;
};

/** True when a provider and key are both configured. */
export const isConfigured = () =>
  PROVIDER !== 'none' && PROVIDER !== '' && Boolean(apiKeyFor(PROVIDER));

/**
 * Public provider status.
 *
 * Returns the provider name and model only — never the key, nor its length or
 * prefix, which are enough to confirm a guess.
 */
export const providerInfo = () => ({
  provider: isConfigured() ? PROVIDER : 'none',
  model: isConfigured() ? modelFor(PROVIDER) : null,
  configured: isConfigured(),
});

/* ------------------------------------------------------------------ *
 * Grok (xAI)
 *
 * Implemented against the official REST API documented at
 * https://docs.x.ai/docs/api-reference — `POST https://api.x.ai/v1/responses`,
 * bearer auth, `{ model, input, instructions, max_output_tokens }`. No SDK, so
 * no new dependency.
 *
 * Two things the shape of that API makes easy to get wrong:
 *
 *   - `output` is an array that interleaves `message` and `reasoning` items.
 *     Reading `output[0].content[0].text` works until the model emits a
 *     reasoning block first, then returns undefined. Text is collected by
 *     filtering on item and content type instead.
 *
 *   - `status` can be `incomplete` on a truncated or filtered response, which
 *     still arrives as HTTP 200. That is treated as a refusal, not as text.
 * ------------------------------------------------------------------ */

/**
 * The official xAI endpoint.
 *
 * `XAI_BASE_URL` exists so the provider can be pointed at a local stub in
 * tests. It must stay unset in production: sending prompts and a bearer key to
 * an arbitrary host is exactly the third-party-proxy arrangement this
 * integration is meant to avoid. There is no scenario in which a deployment
 * should set it.
 */
const XAI_ENDPOINT = process.env.XAI_BASE_URL
  ? `${process.env.XAI_BASE_URL.replace(/\/$/, '')}/v1/responses`
  : 'https://api.x.ai/v1/responses';

/** Extract assistant text, ignoring reasoning items. */
const grokText = (payload) => {
  const output = Array.isArray(payload?.output) ? payload.output : [];

  return output
    .filter((item) => item?.type === 'message')
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .filter((block) => block?.type === 'output_text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('')
    .trim();
};

const generateWithGrok = async ({ system, prompt, maxTokens }) => {
  const apiKey = apiKeyFor('grok');
  const model = modelFor('grok');

  // AbortController rather than relying on the platform default: a hung
  // provider connection would otherwise hold the request until the client
  // gives up, with no useful error.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(XAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        instructions: system,
        input: prompt,
        max_output_tokens: Number(maxTokens) || MAX_OUTPUT_TOKENS,
        // A grounded lookup over supplied passages should be near-extractive.
        temperature: 0.2,
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`xAI request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    // Network-level failure. The message is ours, so it cannot carry a key.
    throw new Error(`xAI request failed: ${error?.code || 'network error'}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // Status only. Provider error bodies can echo the request, and the request
    // carries the Authorization header and the full prompt.
    const label =
      res.status === 401 || res.status === 403
        ? 'xAI rejected the API key'
        : res.status === 429
          ? 'xAI rate limit reached'
          : res.status === 404
            ? `xAI model "${model}" is not available to this account`
            : `xAI request failed with status ${res.status}`;
    throw new Error(label);
  }

  let payload;
  try {
    payload = await res.json();
  } catch {
    throw new Error('xAI returned a malformed response body');
  }

  if (payload?.status === 'incomplete') {
    return {
      text: '',
      refused: true,
      model: payload.model || model,
      usage: payload.usage || null,
    };
  }

  const text = grokText(payload);

  if (!text) {
    // A 200 with no usable text — empty output, an unexpected schema, or a
    // content filter. Callers treat an empty string as a refusal and fall back
    // to retrieval-only output.
    return {
      text: '',
      refused: true,
      model: payload?.model || model,
      usage: payload?.usage || null,
    };
  }

  return { text, model: payload?.model || model, usage: payload?.usage || null };
};

/* ------------------------------------------------------------------ *
 * Groq
 *
 * Groq is NOT Grok. Different company, different API: Groq is a fast-inference
 * host for open models (console.groq.com, keys look like `gsk_…`), while Grok
 * is xAI's own model (console.x.ai, keys look like `xai-…`). They are kept as
 * separate providers because the request and response shapes differ entirely.
 *
 * The API is OpenAI-compatible:
 *   POST https://api.groq.com/openai/v1/chat/completions
 *   { model, messages: [{role, content}], max_completion_tokens, temperature }
 *
 * Two details worth recording, both confirmed against a live account:
 *
 *   - `max_completion_tokens`, not `max_tokens`. The older name is accepted by
 *     some OpenAI-compatible hosts and ignored by others.
 *   - Reasoning models (`openai/gpt-oss-*`) return a separate
 *     `message.reasoning` field alongside `message.content`. Only `content` is
 *     read; concatenating both would publish the model's private reasoning.
 * ------------------------------------------------------------------ */

const GROQ_ENDPOINT = process.env.GROQ_BASE_URL
  ? `${process.env.GROQ_BASE_URL.replace(/\/$/, '')}/openai/v1/chat/completions`
  : 'https://api.groq.com/openai/v1/chat/completions';

const generateWithGroq = async ({ system, prompt, maxTokens }) => {
  const apiKey = apiKeyFor('groq');
  const model = modelFor('groq');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        max_completion_tokens: Number(maxTokens) || MAX_OUTPUT_TOKENS,
        temperature: 0.2,
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Groq request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw new Error(`Groq request failed: ${error?.code || 'network error'}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // Status only — Groq's error bodies can quote the request, which carries
    // the Authorization header and the full prompt.
    const label =
      res.status === 401 || res.status === 403
        ? 'Groq rejected the API key'
        : res.status === 429
          ? 'Groq rate limit reached'
          : res.status === 404
            ? `Groq model "${model}" is not available to this account`
            : `Groq request failed with status ${res.status}`;
    throw new Error(label);
  }

  let payload;
  try {
    payload = await res.json();
  } catch {
    throw new Error('Groq returned a malformed response body');
  }

  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;

  // A length-capped response is truncated mid-sentence; treating it as a
  // refusal is safer than publishing half a grounded answer.
  if (choice?.finish_reason === 'length') {
    return {
      text: '',
      refused: true,
      model: payload.model || model,
      usage: payload.usage || null,
    };
  }

  const text = typeof choice?.message?.content === 'string'
    ? choice.message.content.trim()
    : '';

  if (!text) {
    return {
      text: '',
      refused: true,
      model: payload?.model || model,
      usage: payload?.usage || null,
    };
  }

  return { text, model: payload?.model || model, usage: payload?.usage || null };
};

let clientPromise = null;

const getAnthropicClient = async () => {
  if (!clientPromise) {
    clientPromise = import('@anthropic-ai/sdk')
      .then(({ default: Anthropic }) => new Anthropic({ apiKey: apiKeyFor('anthropic') }))
      .catch((error) => {
        clientPromise = null;
        throw new Error(
          `AI_PROVIDER=anthropic but the SDK is unavailable (${error.message}). ` +
            'Run `npm install @anthropic-ai/sdk` in backend/.',
        );
      });
  }
  return clientPromise;
};

/**
 * Generate an answer from a system prompt and a user prompt.
 *
 * @returns {Promise<{text: string, model: string, usage: object|null}>}
 * @throws when no provider is configured — callers check isConfigured() first
 *         and fall back to retrieval-only output.
 */
export const generateAnswer = async ({ system, prompt, maxTokens }) => {
  if (!isConfigured()) {
    throw new Error('No AI provider configured');
  }

  if (PROVIDER === 'grok') {
    return generateWithGrok({ system, prompt, maxTokens });
  }

  if (PROVIDER === 'groq') {
    return generateWithGroq({ system, prompt, maxTokens });
  }

  if (PROVIDER === 'anthropic') {
    const client = await getAnthropicClient();
    const model = process.env.AI_MODEL || DEFAULT_MODELS.anthropic;

    const response = await client.messages.create({
      model,
      // max_tokens bounds thinking and visible text together on this model
      // family, so it needs headroom above the prose we actually want.
      max_tokens: Math.max(Number(maxTokens) || MAX_OUTPUT_TOKENS, 1024),
      // A grounded lookup over a small corpus does not need deep reasoning;
      // low effort keeps latency and cost down.
      output_config: { effort: 'low' },
      system,
      messages: [{ role: 'user', content: prompt }],
    });

    // Safety classifiers can decline a request: that returns HTTP 200 with
    // stop_reason 'refusal' and an empty content array, so reading content[0]
    // unconditionally would throw.
    if (response.stop_reason === 'refusal') {
      return {
        text: '',
        refused: true,
        model: response.model,
        usage: response.usage || null,
      };
    }

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();

    return { text, model: response.model, usage: response.usage || null };
  }

  if (PROVIDER === 'openai') {
    // Implemented against the REST endpoint so no extra dependency is needed.
    const model = process.env.AI_MODEL || DEFAULT_MODELS.openai;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKeyFor('openai')}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: Number(maxTokens) || MAX_OUTPUT_TOKENS,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI request failed with status ${res.status}`);
    }

    const data = await res.json();
    return {
      text: (data.choices?.[0]?.message?.content || '').trim(),
      model,
      usage: data.usage || null,
    };
  }

  throw new Error(`Unknown AI_PROVIDER: ${PROVIDER}`);
};
