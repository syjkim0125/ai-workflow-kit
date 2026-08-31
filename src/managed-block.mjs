export const START_MARKER = '<!-- BEGIN ai-workflow-kit -->';
export const END_MARKER = '<!-- END ai-workflow-kit -->';

export const MANAGED_BLOCK = `${START_MARKER}
## AI workflow

- Start product or engineering work with the \`workflow\` skill before implementation.
- Keep one concise canonical Story contract: Goal, Domain, MUST, SHOULD, OUT, Decisions, Verify.
- Ask only blocking behavior questions; label safe defaults \`ASSUMED\` instead of silently inventing scope.
- Keep Tasks at most 30 non-empty lines and reference Story M/V IDs; HOW belongs to the repository-grounded plan.
- Use Compound Engineering when available: normal work \`ce-plan → ce-work → ce-code-review\`; high-risk work adds a human plan gate.
- Do not merge non-trivial changes until the workflow's G4 question gate records that a human understands behavior, an invariant/failure path, and the evidence boundary.
${END_MARKER}`;

function markerRange(content) {
  const start = content.indexOf(START_MARKER);
  const endStart = content.indexOf(END_MARKER);
  if (start < 0 && endStart < 0) return null;
  if (start < 0 || endStart < start) {
    throw new Error('Malformed ai-workflow-kit managed block. Restore both markers before retrying.');
  }
  return { start, end: endStart + END_MARKER.length };
}

export function upsertManagedBlock(content = '', block = MANAGED_BLOCK) {
  const range = markerRange(content);
  if (range) {
    return `${content.slice(0, range.start)}${block}${content.slice(range.end)}`;
  }

  const trimmed = content.replace(/\s+$/u, '');
  return trimmed ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}

export function removeManagedBlock(content = '') {
  const range = markerRange(content);
  if (!range) return content;

  const before = content.slice(0, range.start).replace(/[ \t]+$/u, '');
  const after = content.slice(range.end).replace(/^\s*\n/u, '');
  const joined = `${before}${after ? `\n${after}` : ''}`;
  return joined.replace(/\n{3,}/gu, '\n\n').replace(/^\n+/u, '').replace(/\s+$/u, '') + (joined.trim() ? '\n' : '');
}
