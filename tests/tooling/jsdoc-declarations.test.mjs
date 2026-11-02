import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const repository = path.resolve(import.meta.dirname, '../..');
const normalize = text => text.replace(/\s+/g, ' ').trim();

function documentation(text) {
  const source = ts.createSourceFile('api.ts', text, ts.ScriptTarget.Latest, true);
  const blocks = [];
  const visit = node => {
    for (const doc of node.jsDoc ?? []) blocks.push(normalize(doc.getText(source)));
    ts.forEachChild(node, visit);
  };
  visit(source);
  return blocks;
}

test('tsup declarations: public source JSDoc -> retains shipped function and type-field documentation', async () => {
  const files = [
    'src/core/createFetcher.ts',
    'src/openapi/bodies.ts',
    'src/openapi/fetcher.ts',
    'src/openapi/parameters.ts',
    'src/openapi/responses.ts',
    'src/openapi/shared.ts',
  ];
  const source = await Promise.all(files.map(file => readFile(path.join(repository, file), 'utf8')));
  const declaration = await readFile(path.join(repository, 'dist/core.d.ts'), 'utf8');
  const expected = source.flatMap(documentation);

  const shipped = new Set(documentation(declaration));

  assert.ok(expected.length > 0);
  for (const block of expected) {
    assert.ok(shipped.has(block), `Declaration documentation was dropped: ${block}`);
  }
});
