import { digest, readJson, readProjectFile } from './storage.mjs';

export function approvalPath(text, gate) {
  return text.match(new RegExp(`^Understanding gate \\(${gate}\\):\\s*([^·|\\n]+)[·|]`, 'im'))?.[1].trim();
}

// Binding prevents accidental reuse. It does not authenticate the host or the human.
export async function boundApproval({ root, story, gate, expected, checkGate, validate }) {
  const checked = await checkGate({ root, file: story, gate });
  if (!checked.ok) throw new Error(checked.errors.join('\n'));
  const file = approvalPath(await readProjectFile(root, story), gate);
  if (!file) throw new Error(`${gate} requires a bound approval JSON artifact.`);
  const value = await readJson(root, file);
  if (value.gate !== gate || typeof value.responseRef !== 'string' || !value.responseRef.trim()
    || Object.entries(expected).some(([key, expectedValue]) => value[key] !== expectedValue)) {
    throw new Error(`${gate} approval binding changed or missing; obtain a fresh human decision for this Story/revision.`);
  }
  validate?.(value);
  return { file, hash: digest(JSON.stringify(value)) };
}

/** The G4 record mode, from its Story gate line; a line without "Mode:" is human restatement. */
export function storyG4Mode(text) {
  const record = text.match(/^Understanding gate \(G4\):(.*)$/imu)?.[1] ?? '';
  // Same parse as g4Mode in check.mjs; graph code receives the checker by injection.
  return record.match(/\bMode:\s*([\w-]+)/iu)?.[1]?.toLowerCase() === 'ai-summary' ? 'ai-summary' : 'human-restatement';
}

// The approval JSON must hold what the Story's G4 mode promises: for ai-summary, the
// four lines shown and the human's actual reply. G3 work never uses ai-summary.
export function checkG4Record(value, { mode, requiresG3 }) {
  const recorded = value.mode ?? 'human-restatement';
  if (requiresG3 && (mode === 'ai-summary' || recorded === 'ai-summary')) {
    throw new Error('A run that requires G3 needs G4 by human restatement, not ai-summary.');
  }
  if (recorded !== mode) {
    throw new Error(`G4 approval mode (${recorded}) does not match the Story's G4 record (${mode}); record the approval for the mode actually used.`);
  }
  if (mode !== 'ai-summary') return;
  if (!Array.isArray(value.summary) || value.summary.length !== 4
    || !value.summary.every((line) => typeof line === 'string' && line.trim())) {
    throw new Error('G4 ai-summary approval needs summary: the four non-empty lines shown to the human.');
  }
  if (typeof value.approvalText !== 'string' || !value.approvalText.trim()) {
    throw new Error("G4 ai-summary approval needs approvalText: the human's actual reply.");
  }
}
