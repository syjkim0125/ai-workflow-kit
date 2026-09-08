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
- Gates are satisfied by evidence, not by assertion. Verify with \`node .ai-workflow/bin/check.mjs story <story-file>\` and report the exit code; exit 0 is the only pass.
${END_MARKER}`;

export function managedBlockFor(host) {
  const command = host === 'codex' ? '$workflow' : '/workflow';
  return MANAGED_BLOCK.replace('## AI workflow', `## AI workflow\n\nInvoke: \`${command} <request>\`, \`${command} status\`, \`${command} finish\`. Start a new task/session after installation or updates.`);
}

// A marker only counts when it is a line of its own and sits outside a fenced code
// block. Instruction files legitimately document this kit's own marker syntax; a
// substring match would treat that example as the live block and silently rewrite it.
function scanMarkers(content) {
  const lines = content.split(/\n/u);
  let offset = 0;
  let fenced = false;
  const found = [];

  for (const line of lines) {
    const bare = line.replace(/\r$/u, '').trim();

    if (/^(?:`{3,}|~{3,})/u.test(bare)) {
      fenced = !fenced;
    } else if (!fenced) {
      if (bare === START_MARKER) found.push({ kind: 'start', start: offset, end: offset + line.length });
      else if (bare === END_MARKER) found.push({ kind: 'end', start: offset, end: offset + line.length });
    }

    offset += line.length + 1; // + the newline consumed by split
  }
  return found;
}

function markerRange(content) {
  const found = scanMarkers(content);
  if (found.length === 0) return null;

  const starts = found.filter((marker) => marker.kind === 'start');
  const ends = found.filter((marker) => marker.kind === 'end');
  if (starts.length !== 1 || ends.length !== 1 || ends[0].start < starts[0].start) {
    throw new Error('Malformed ai-workflow-kit managed block. Restore both markers before retrying.');
  }
  return { start: starts[0].start, end: ends[0].end };
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
