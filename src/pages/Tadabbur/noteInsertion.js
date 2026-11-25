export function insertNote(text, block, range) {
  const start = range?.start ?? text.length;
  const end = range?.end ?? start;
  const before = text.slice(0, start);
  const after = text.slice(end);
  const prefix = before ? '\n'.repeat(Math.max(0, 2 - (before.match(/\n+$/)?.[0].length || 0))) : '';
  const suffix = after ? '\n'.repeat(Math.max(0, 2 - (after.match(/^\n+/)?.[0].length || 0))) : '';
  return { text: before + prefix + block + suffix + after, caret: before.length + prefix.length + block.length };
}
