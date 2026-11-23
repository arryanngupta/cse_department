/**
 * Language switcher consistency.
 *
 * Lives in the backend suite because that is the only automated suite the
 * project runs; the thing under test is two static files that must agree.
 *
 * The failure mode this exists to catch: the switcher reads its options from
 * client/src/lib/languages.js, but the actual translating is done by the Google
 * Translate widget, which only accepts the codes listed in `includedLanguages`
 * in client/index.html. A code present in one and absent from the other
 * produces a menu entry that looks fine and does nothing when chosen — no
 * error, no console warning, just a dead option.
 */

import test, { describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(here, '../../client');

let htmlCodes = [];
let jsCodes = [];
let languagesSource = '';

before(async () => {
  const html = await fs.readFile(path.join(clientDir, 'index.html'), 'utf8');
  const match = html.match(/includedLanguages:\s*'([^']+)'/);
  assert.ok(match, 'index.html must declare includedLanguages');
  htmlCodes = match[1].split(',').map((c) => c.trim()).filter(Boolean);

  languagesSource = await fs.readFile(
    path.join(clientDir, 'src/lib/languages.js'),
    'utf8',
  );
  jsCodes = [...languagesSource.matchAll(/code:\s*'([^']+)'/g)].map((m) => m[1]);
});

describe('language switcher', () => {
  test('every offered language is one the widget can actually translate', () => {
    const dead = jsCodes.filter((c) => !htmlCodes.includes(c));
    assert.deepEqual(
      dead,
      [],
      `these are offered in the switcher but missing from includedLanguages, ` +
        `so choosing them does nothing: ${dead.join(', ')}`,
    );
  });

  test('no language is enabled in the widget but hidden from the switcher', () => {
    const unreachable = htmlCodes.filter((c) => !jsCodes.includes(c));
    assert.deepEqual(
      unreachable,
      [],
      `enabled in includedLanguages but absent from the switcher: ${unreachable.join(', ')}`,
    );
  });

  test('English is present as the source language', () => {
    assert.ok(jsCodes.includes('en'), 'the reset-to-source option must exist');
    assert.ok(htmlCodes.includes('en'));
  });

  test('no duplicate language codes', () => {
    assert.equal(new Set(jsCodes).size, jsCodes.length, 'duplicate code in languages.js');
    assert.equal(new Set(htmlCodes).size, htmlCodes.length, 'duplicate code in index.html');
  });

  test('every language carries an endonym and an English name', () => {
    // A switcher listing only English names is unusable by the person who most
    // needs it, so the endonym is not optional.
    const entries = [...languagesSource.matchAll(/\{\s*code:\s*'([^']+)'[^}]*\}/g)];
    assert.ok(entries.length >= jsCodes.length, 'could not parse the language entries');

    for (const [entry, code] of entries.map((m) => [m[0], m[1]])) {
      assert.match(entry, /endonym:\s*'[^']+'/, `${code} is missing an endonym`);
      assert.match(entry, /english:\s*'[^']+'/, `${code} is missing an English name`);
    }
  });

  test('right-to-left languages are flagged', () => {
    // Urdu and Arabic need dir="rtl" on their option, or the script renders
    // with the wrong directionality inside an otherwise LTR menu.
    for (const code of ['ur', 'ar']) {
      if (!jsCodes.includes(code)) continue;
      const entry = languagesSource.match(
        new RegExp(`\\{\\s*code:\\s*'${code}'[^}]*\\}`),
      );
      assert.ok(entry, `${code} entry not found`);
      assert.match(entry[0], /rtl:\s*true/, `${code} must be marked rtl`);
    }
  });

  test('the switcher menu is excluded from translation', async () => {
    // Without notranslate, switching to Hindi translates the language names
    // themselves and the list becomes useless for finding the way back.
    const component = await fs.readFile(
      path.join(clientDir, 'src/components/common/LanguageSwitcher.jsx'),
      'utf8',
    );
    assert.match(component, /notranslate/, 'the listbox must carry notranslate');
    assert.match(component, /translate="no"/, 'and the translate="no" attribute');
  });

  test('the old two-language text toggle is gone', async () => {
    const navbar = await fs.readFile(
      path.join(clientDir, 'src/components/Navbar.jsx'),
      'utf8',
    );
    assert.match(navbar, /LanguageSwitcher/, 'the navbar should render the switcher');
    assert.ok(
      !/changeLanguage/.test(navbar),
      'the replaced inline handler should not linger as dead code',
    );
  });
});
