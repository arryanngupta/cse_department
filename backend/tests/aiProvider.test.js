/**
 * Grok provider tests.
 *
 * Runs the real provider code against a local stub that mimics the documented
 * xAI `/v1/responses` contract, so the response parsing and every failure mode
 * are exercised without a live key or a billable request.
 *
 * The stub deliberately echoes the Authorization header back in one error
 * body, because a provider that forwards an upstream error body to the client
 * is how an API key ends up in a browser. Each case asserts the key never
 * appears in whatever the provider surfaces.
 */

import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const TEST_KEY = 'xai-TEST-KEY-MUST-NOT-LEAK';

/** Documented shape: output interleaves `reasoning` and `message` items. */
const okBody = {
  id: 'resp_1',
  object: 'response',
  created_at: 1754475266,
  model: 'grok-4.7',
  status: 'completed',
  output: [
    { type: 'reasoning', summary: [{ type: 'summary_text', text: 'internal reasoning' }] },
    {
      type: 'message',
      role: 'assistant',
      content: [
        { type: 'output_text', text: 'The department offers B.Tech and M.Tech programmes [1].' },
      ],
    },
  ],
  usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
};

const SCENARIOS = {
  ok: { status: 200, body: okBody },

  // A reasoning block and no message: output[0].content[0].text would throw.
  reasoningOnly: {
    status: 200,
    body: { status: 'completed', model: 'grok-4.7', output: [okBody.output[0]] },
  },

  incomplete: { status: 200, body: { status: 'incomplete', model: 'grok-4.7', output: [] } },
  emptyOutput: { status: 200, body: { status: 'completed', model: 'grok-4.7', output: [] } },
  wrongSchema: { status: 200, body: { status: 'completed', choices: [{ text: 'wrong shape' }] } },
  malformed: { status: 200, raw: 'definitely not json' },

  unauthorized: {
    status: 401,
    // Echoing the request back is a real provider behaviour and a real leak risk.
    body: { error: 'invalid api key', request: { authorization: `Bearer ${TEST_KEY}` } },
  },
  forbidden: { status: 403, body: { error: 'forbidden' } },
  rateLimited: { status: 429, body: { error: 'rate limit exceeded' } },
  modelMissing: { status: 404, body: { error: 'model not found' } },
  serverError: { status: 500, body: { error: 'internal' } },
  hang: { hang: true },
};

let server;
let baseUrl;
let lastRequest = null;

before(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const name = req.url.replace('/v1/responses', '').replace('/', '') || 'ok';
      const scenario = SCENARIOS[name] || SCENARIOS.ok;

      lastRequest = {
        method: req.method,
        auth: req.headers.authorization,
        contentType: req.headers['content-type'],
        body: (() => { try { return JSON.parse(body); } catch { return null; } })(),
      };

      if (scenario.hang) return; // never respond, to exercise the timeout

      res.writeHead(scenario.status, { 'Content-Type': 'application/json' });
      res.end(scenario.raw !== undefined ? scenario.raw : JSON.stringify(scenario.body));
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
});

/**
 * Load a fresh copy of the provider with the given environment.
 *
 * aiProvider reads AI_PROVIDER at module scope, so the cache has to be busted
 * per configuration — hence the query-string import.
 */
let loadCounter = 0;
const loadProvider = async (env = {}) => {
  Object.assign(process.env, {
    AI_PROVIDER: 'grok',
    XAI_API_KEY: TEST_KEY,
    XAI_BASE_URL: baseUrl,
    AI_TIMEOUT_MS: '1500',
    ...env,
  });

  loadCounter += 1;
  return import(`../src/services/aiProvider.js?case=${loadCounter}`);
};

const callScenario = async (scenario, env = {}) => {
  const provider = await loadProvider({ XAI_BASE_URL: `${baseUrl}/${scenario}`, ...env });
  try {
    const result = await provider.generateAnswer({ system: 'SYSTEM', prompt: 'QUESTION' });
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};

describe('grok provider — request shape', () => {
  test('posts the documented fields with bearer auth', async () => {
    const result = await callScenario('ok');
    assert.equal(result.ok, true);

    assert.equal(lastRequest.method, 'POST');
    assert.equal(lastRequest.auth, `Bearer ${TEST_KEY}`);
    assert.match(lastRequest.contentType, /application\/json/);

    // Field names must match the xAI Responses API, not OpenAI's chat schema.
    assert.equal(lastRequest.body.model, 'grok-4.7');
    assert.equal(lastRequest.body.instructions, 'SYSTEM');
    assert.equal(lastRequest.body.input, 'QUESTION');
    assert.equal(typeof lastRequest.body.max_output_tokens, 'number');
    assert.ok(!('messages' in lastRequest.body), 'must not send OpenAI-style messages');
    assert.ok(!('max_tokens' in lastRequest.body), 'must not send OpenAI-style max_tokens');
  });

  test('XAI_MODEL overrides the default model', async () => {
    await callScenario('ok', { XAI_MODEL: 'grok-4.3' });
    assert.equal(lastRequest.body.model, 'grok-4.3');
    delete process.env.XAI_MODEL;
  });
});

describe('grok provider — response parsing', () => {
  test('extracts text from the message item, skipping reasoning', async () => {
    const result = await callScenario('ok');
    assert.equal(result.ok, true);
    assert.equal(result.text, 'The department offers B.Tech and M.Tech programmes [1].');
    assert.ok(!result.text.includes('internal reasoning'), 'reasoning must not leak into the answer');
    assert.equal(result.model, 'grok-4.7');
  });

  test('a reasoning-only output is a refusal, not a crash', async () => {
    const result = await callScenario('reasoningOnly');
    assert.equal(result.ok, true);
    assert.equal(result.refused, true);
    assert.equal(result.text, '');
  });

  test('status "incomplete" is treated as a refusal', async () => {
    const result = await callScenario('incomplete');
    assert.equal(result.ok, true);
    assert.equal(result.refused, true);
  });

  test('an empty output array is a refusal', async () => {
    const result = await callScenario('emptyOutput');
    assert.equal(result.ok, true);
    assert.equal(result.refused, true);
  });

  test('an unexpected schema is a refusal, not an exception', async () => {
    const result = await callScenario('wrongSchema');
    assert.equal(result.ok, true);
    assert.equal(result.refused, true);
  });

  test('a malformed body produces a clean error', async () => {
    const result = await callScenario('malformed');
    assert.equal(result.ok, false);
    assert.match(result.error, /malformed/i);
  });
});

describe('grok provider — failures never leak the key', () => {
  const cases = [
    ['unauthorized', /rejected the API key/i],
    ['forbidden', /rejected the API key/i],
    ['rateLimited', /rate limit/i],
    ['modelMissing', /not available/i],
    ['serverError', /status 500/],
  ];

  for (const [scenario, expected] of cases) {
    test(`${scenario} surfaces a safe message`, async () => {
      const result = await callScenario(scenario);
      assert.equal(result.ok, false, `${scenario} should fail`);
      assert.match(result.error, expected);

      // The decisive assertion: whatever we surface cannot contain the key,
      // even though the 401 stub echoes it back in its body.
      assert.ok(!result.error.includes(TEST_KEY), `${scenario} leaked the API key`);
      assert.ok(!/xai-[A-Za-z0-9-]{10,}/.test(result.error), `${scenario} leaked a key-shaped string`);
    });
  }

  test('a hung connection times out rather than hanging the request', async () => {
    const started = Date.now();
    const result = await callScenario('hang', { AI_TIMEOUT_MS: '800' });
    const elapsed = Date.now() - started;

    assert.equal(result.ok, false);
    assert.match(result.error, /timed out/i);
    assert.ok(elapsed < 5000, `timeout took ${elapsed}ms — the abort signal is not working`);
    assert.ok(!result.error.includes(TEST_KEY));
  });

  test('an unreachable host produces a clean error', async () => {
    // Port 1 is reserved and refuses immediately.
    const result = await callScenario('ok', { XAI_BASE_URL: 'http://127.0.0.1:1' });
    assert.equal(result.ok, false);
    assert.match(result.error, /xAI request failed/i);
    assert.ok(!result.error.includes(TEST_KEY));
  });
});

/* ================================================================== *
 * Groq — a different provider from Grok, with a different wire format
 * ================================================================== */

const GROQ_KEY = 'gsk_TEST-KEY-MUST-NOT-LEAK';

/** OpenAI-compatible shape, including the separate `reasoning` field. */
const groqOkBody = {
  id: 'chatcmpl-1',
  object: 'chat.completion',
  model: 'openai/gpt-oss-120b',
  choices: [
    {
      index: 0,
      finish_reason: 'stop',
      message: {
        role: 'assistant',
        content: 'The M.Tech programme lasts two years【1】.',
        reasoning: 'PRIVATE CHAIN OF THOUGHT',
      },
    },
  ],
  usage: { prompt_tokens: 116, completion_tokens: 70, total_tokens: 186 },
};

const GROQ_SCENARIOS = {
  ok: { status: 200, body: groqOkBody },
  truncated: {
    status: 200,
    body: {
      ...groqOkBody,
      choices: [{ ...groqOkBody.choices[0], finish_reason: 'length' }],
    },
  },
  emptyContent: {
    status: 200,
    body: {
      ...groqOkBody,
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: '' } }],
    },
  },
  noChoices: { status: 200, body: { id: 'x', object: 'chat.completion', choices: [] } },
  unauthorized: {
    status: 401,
    body: { error: { message: 'Invalid API Key', sent: `Bearer ${GROQ_KEY}` } },
  },
  rateLimited: { status: 429, body: { error: { message: 'rate_limit_exceeded' } } },
  modelMissing: { status: 404, body: { error: { message: 'model_not_found' } } },
  serverError: { status: 500, body: { error: { message: 'internal' } } },
};

let groqServer;
let groqBase;
let groqLastRequest = null;

before(async () => {
  groqServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const name = req.url.replace('/openai/v1/chat/completions', '').replace('/', '') || 'ok';
      const scenario = GROQ_SCENARIOS[name] || GROQ_SCENARIOS.ok;

      groqLastRequest = {
        auth: req.headers.authorization,
        body: (() => { try { return JSON.parse(body); } catch { return null; } })(),
      };

      res.writeHead(scenario.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(scenario.body));
    });
  });
  await new Promise((resolve) => groqServer.listen(0, '127.0.0.1', resolve));
  groqBase = `http://127.0.0.1:${groqServer.address().port}`;
});

after(() => {
  groqServer?.close();
});

let groqCounter = 0;
const callGroq = async (scenario, env = {}) => {
  groqCounter += 1;
  Object.assign(process.env, {
    AI_PROVIDER: 'groq',
    GROQ_API_KEY: GROQ_KEY,
    GROQ_BASE_URL: `${groqBase}/${scenario}`,
    AI_TIMEOUT_MS: '1500',
    ...env,
  });

  const provider = await import(`../src/services/aiProvider.js?groq=${groqCounter}`);
  try {
    return { ok: true, ...(await provider.generateAnswer({ system: 'SYSTEM', prompt: 'QUESTION' })) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};

describe('groq provider — request shape', () => {
  test('posts OpenAI-compatible fields with bearer auth', async () => {
    const result = await callGroq('ok');
    assert.equal(result.ok, true);

    assert.equal(groqLastRequest.auth, `Bearer ${GROQ_KEY}`);
    assert.equal(groqLastRequest.body.model, 'openai/gpt-oss-120b');

    // Groq takes a messages array, not xAI's instructions/input pair.
    assert.deepEqual(groqLastRequest.body.messages, [
      { role: 'system', content: 'SYSTEM' },
      { role: 'user', content: 'QUESTION' },
    ]);

    // max_completion_tokens, not max_tokens — some OpenAI-compatible hosts
    // silently ignore the older name.
    assert.equal(typeof groqLastRequest.body.max_completion_tokens, 'number');
    assert.ok(!('max_tokens' in groqLastRequest.body));
    assert.ok(!('input' in groqLastRequest.body), 'must not send the xAI field names');
    assert.ok(!('instructions' in groqLastRequest.body));
  });

  test('GROQ_MODEL overrides the default', async () => {
    await callGroq('ok', { GROQ_MODEL: 'openai/gpt-oss-20b' });
    assert.equal(groqLastRequest.body.model, 'openai/gpt-oss-20b');
    delete process.env.GROQ_MODEL;
  });
});

describe('groq provider — response parsing', () => {
  test('reads message.content and never the private reasoning field', async () => {
    const result = await callGroq('ok');
    assert.equal(result.ok, true);
    assert.match(result.text, /two years/);

    // The decisive assertion: gpt-oss models return their chain of thought in a
    // sibling field. Publishing it would expose the model's private reasoning.
    assert.ok(
      !result.text.includes('PRIVATE CHAIN OF THOUGHT'),
      'message.reasoning must never reach the answer',
    );
  });

  test('a length-truncated response is a refusal, not half an answer', async () => {
    const result = await callGroq('truncated');
    assert.equal(result.ok, true);
    assert.equal(result.refused, true);
    assert.equal(result.text, '');
  });

  test('empty content and missing choices are refusals', async () => {
    for (const scenario of ['emptyContent', 'noChoices']) {
      const result = await callGroq(scenario);
      assert.equal(result.ok, true, scenario);
      assert.equal(result.refused, true, scenario);
    }
  });
});

describe('groq provider — failures never leak the key', () => {
  const cases = [
    ['unauthorized', /rejected the API key/i],
    ['rateLimited', /rate limit/i],
    ['modelMissing', /not available/i],
    ['serverError', /status 500/],
  ];

  for (const [scenario, expected] of cases) {
    test(`${scenario} surfaces a safe message`, async () => {
      const result = await callGroq(scenario);
      assert.equal(result.ok, false, scenario);
      assert.match(result.error, expected);

      // The 401 stub echoes the key back in its body, as real providers do.
      assert.ok(!result.error.includes(GROQ_KEY), `${scenario} leaked the key`);
      assert.ok(!/gsk_[A-Za-z0-9]{10,}/.test(result.error), `${scenario} leaked a key-shaped string`);
    });
  }

  test('providerInfo never exposes the Groq key', async () => {
    groqCounter += 1;
    Object.assign(process.env, { AI_PROVIDER: 'groq', GROQ_API_KEY: GROQ_KEY });
    const provider = await import(`../src/services/aiProvider.js?groqinfo=${groqCounter}`);

    const info = provider.providerInfo();
    assert.equal(info.provider, 'groq');
    assert.equal(info.configured, true);

    const serialized = JSON.stringify(info);
    assert.ok(!serialized.includes(GROQ_KEY));
    assert.ok(!/gsk_/.test(serialized));
  });
});

describe('grok provider — configuration', () => {
  test('is not configured without a key, and never throws on status', async () => {
    const provider = await loadProvider({ XAI_API_KEY: '', AI_API_KEY: '' });
    assert.equal(provider.isConfigured(), false);

    const info = provider.providerInfo();
    assert.equal(info.configured, false);
    assert.equal(info.provider, 'none');
    assert.equal(info.model, null);

    await assert.rejects(
      () => provider.generateAnswer({ system: 's', prompt: 'p' }),
      /No AI provider configured/,
    );

    process.env.XAI_API_KEY = TEST_KEY;
  });

  test('providerInfo never exposes the key', async () => {
    const provider = await loadProvider();
    const info = provider.providerInfo();

    assert.equal(info.configured, true);
    assert.equal(info.provider, 'grok');

    const serialized = JSON.stringify(info);
    assert.ok(!serialized.includes(TEST_KEY));
    assert.ok(!/xai-/.test(serialized));
    assert.ok(!('apiKey' in info) && !('key' in info));
  });

  test('falls back to AI_API_KEY when XAI_API_KEY is unset', async () => {
    const provider = await loadProvider({ XAI_API_KEY: '', AI_API_KEY: 'generic-key-value' });
    assert.equal(provider.isConfigured(), true);

    process.env.XAI_API_KEY = TEST_KEY;
    delete process.env.AI_API_KEY;
  });
});
