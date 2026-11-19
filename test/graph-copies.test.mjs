import assert from 'node:assert/strict';
import test from 'node:test';
import { graphProject } from './fixtures/graph-project.mjs';

// Two brands, each with pc and mobile, plus an unrelated file of the same name elsewhere.
const layout = async f => {
  for (const file of [
    'src/shop/brand-a/mobile/components/Cashback/CashbackToolTip.tsx',
    'src/shop/brand-a/mobile/components/Cashback/index.tsx',
    'src/shop/brand-a/pc/components/Cashback/CashbackTooltip.tsx',
    'src/shop/brand-a/pc/components/Cashback/index.tsx',
    'src/shop/brand-b/ko/mobile/components/Cashback/CashbackToolTip.tsx',
    'src/shop/brand-b/ko/mobile/components/Cashback/index.tsx',
    'src/shop/brand-b/ko/pc/components/Cashback/CashbackTooltip.tsx',
    'src/shop/brand-b/ko/pc/components/Cashback/index.tsx',
    'src/admin/widgets/index.tsx',
    'node_modules/pkg/components/Cashback/CashbackToolTip.tsx',
  ]) await f.put(file, '\n');
};

test('copies lists files with the same name and parent in sibling folders', async t => {
  const f = await graphProject(t);
  await layout(f);
  const out = f.ok('copies', 'src/shop/brand-a/mobile/components/Cashback/CashbackToolTip.tsx');
  assert.deepEqual(out.copies, [{ path: 'src/shop/brand-a/mobile/components/Cashback/CashbackToolTip.tsx', copies: [
    // The closest copy first: the other brand's mobile file, then the pc files whose name differs only in case.
    'src/shop/brand-b/ko/mobile/components/Cashback/CashbackToolTip.tsx',
    'src/shop/brand-a/pc/components/Cashback/CashbackTooltip.tsx',
    'src/shop/brand-b/ko/pc/components/Cashback/CashbackTooltip.tsx',
  ] }]);
  assert.match(out.rule, /To-be/);
  assert.match(out.rule, /OPEN BLOCKING/);
});

test('copies needs the parent folder to match, so a shared file name alone is not a copy', async t => {
  const f = await graphProject(t);
  await layout(f);
  const out = f.ok('copies', 'src/shop/brand-a/mobile/components/Cashback/index.tsx');
  assert.deepEqual(out.copies[0].copies, ['src/shop/brand-b/ko/mobile/components/Cashback/index.tsx',
    'src/shop/brand-a/pc/components/Cashback/index.tsx', 'src/shop/brand-b/ko/pc/components/Cashback/index.tsx']);
});

test('copies takes folders and several paths', async t => {
  const f = await graphProject(t);
  await layout(f);
  const out = f.ok('copies', 'src/shop/brand-a/mobile/components/Cashback', 'src/admin/widgets/index.tsx');
  assert.deepEqual(out.copies, [
    { path: 'src/shop/brand-a/mobile/components/Cashback', copies: [
      'src/shop/brand-b/ko/mobile/components/Cashback', 'src/shop/brand-a/pc/components/Cashback', 'src/shop/brand-b/ko/pc/components/Cashback'] },
    { path: 'src/admin/widgets/index.tsx', copies: [] },
  ]);
});

test('copies rejects a path that does not exist', async t => {
  const f = await graphProject(t);
  const result = f.cli('copies', 'src/missing.tsx');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /src\/missing\.tsx/);
});

test('a folder whose name differs is a copy when it holds the same files', async t => {
  const f = await graphProject(t);
  await layout(f);
  // brand-a and brand-b/ko have different names but the same layout inside.
  const out = f.ok('copies', 'src/shop/brand-a');
  assert.deepEqual(out.copies, [{ path: 'src/shop/brand-a', copies: ['src/shop/brand-b/ko'] }]);
});
