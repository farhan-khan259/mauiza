const STOP_PREFIX = /^(may contain|contains|allergy advice|for allergens|nutrition|store in|best before|produced in|made in|packed in)\b/i;
const E_NUMBER = /\bE\s*-?\s*\d{3,4}[a-f]?\b/i;

function clean(value) {
  return value.replace(/_([^_]+)_/g, "$1").replace(/^\s*(ingredients?|composition)\s*:\s*/i, "")
    .replace(/^\s*[^:]{1,28}:\s+(?=[a-z])/i, "").replace(/\b\d+(?:[.,]\d+)?\s*%/g, "")
    .replace(/\s+/g, " ").replace(/^[\s:–—-]+|[\s:–—-]+$/g, "").trim();
}

export function splitIngredients(input) {
  const output = [];
  let token = "", depth = 0;
  const push = value => {
    const item = clean(value);
    if (!item || STOP_PREFIX.test(item)) return;
    const bracket = item.match(/^(.+?)\s*[\[(]([^)\]]+)[)\]]$/);
    if (bracket) {
      const inside = clean(bracket[2]);
      const words = inside.split(/\s+/).filter(Boolean);
      if (/^\d+(?:[.,]\d+)?\s*%$/.test(bracket[2].trim())) return push(bracket[1]);
      if (words.length <= 3 && !E_NUMBER.test(inside) && !/[,;、，؛]/.test(inside)) {
        output.push(`${clean(bracket[1])} (${inside})`); return;
      }
      if (!E_NUMBER.test(inside)) push(bracket[1]); splitIngredients(inside).forEach(part => output.push(part)); return;
    }
    const colourParts = item.split(/\s+and\s+(?=E\s*-?\s*\d{3,4}[a-f]?\b)/i);
    if (colourParts.length > 1) return colourParts.forEach(push);
    output.push(item);
  };
  for (const char of String(input || "")) {
    if ("([{".includes(char)) depth += 1;
    if (")]}".includes(char)) depth = Math.max(0, depth - 1);
    if (depth === 0 && /[,;\n、，؛]/.test(char)) { push(token); token = ""; } else token += char;
  }
  push(token);
  return [...new Map(output.map(item => [item.toLocaleLowerCase(), item])).values()].slice(0, 120);
}

export function extractIngredientsSection(text) {
  const normalized = String(text || "").replace(/\r/g, "");
  const start = normalized.search(/\bingredients?\s*:?/i);
  const section = start >= 0 ? normalized.slice(start).replace(/^.*?ingredients?\s*:?/i, "") : normalized;
  return section.split(/\n\s*(?:allerg(?:y|ens?)|nutrition(?:al)?|storage|directions?|best before|warning)\b/i)[0].trim();
}

export function isValidBarcode(value) {
  const code = String(value || "").replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(code.length)) return false;
  const digits = [...code].map(Number); const check = digits.pop();
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === check;
}

export function expandUpce(code) {
  if (!/^[01]\d{7}$/.test(code) || !isValidBarcode(code)) return null;
  const ns = code[0], d = code.slice(1, 7), check = code[7], last = d[5]; let body;
  if (/[012]/.test(last)) body = `${d.slice(0, 2)}${last}0000${d.slice(2, 5)}`;
  else if (last === "3") body = `${d.slice(0, 3)}00000${d.slice(3, 5)}`;
  else if (last === "4") body = `${d.slice(0, 4)}00000${d[4]}`;
  else body = `${d.slice(0, 5)}0000${last}`;
  return `${ns}${body}${check}`;
}

export function barcodeCandidates(raw) {
  const code = String(raw || "").replace(/\D/g, "");
  return [...new Set([code, expandUpce(code), code.length === 12 ? `0${code}` : null, code.length === 13 && code[0] === "0" ? code.slice(1) : null].filter(Boolean))];
}
