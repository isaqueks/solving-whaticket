// Chamado #95: recorte do texto da mensagem em volta do termo buscado e
// posições a destacar. A comparação ignora acentos e maiúsculas, igual à busca
// do backend ("quitacao" acha "QUITAÇÃO"), mas o texto exibido é o original.

const DIACRITICS = /[̀-ͯ]/g;

export const normalizeText = (text) =>
  String(text || "")
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase();

// Versão normalizada do texto + mapa índice normalizado -> índice original.
const buildIndex = (text) => {
  let normalized = "";
  const map = [];
  for (let i = 0; i < text.length; i++) {
    const piece = normalizeText(text[i]);
    for (let k = 0; k < piece.length; k++) {
      normalized += piece[k];
      map.push(i);
    }
  }
  map.push(text.length);
  return { normalized, map };
};

// Intervalos [início, fim) do texto original onde o termo aparece.
export const findMatches = (text, term) => {
  const needle = normalizeText(term).trim();
  if (!text || !needle) return [];

  const { normalized, map } = buildIndex(text);
  const ranges = [];
  let from = 0;
  while (from <= normalized.length - needle.length) {
    const pos = normalized.indexOf(needle, from);
    if (pos === -1) break;
    ranges.push([map[pos], map[pos + needle.length]]);
    from = pos + needle.length;
  }
  return ranges;
};

// O resultado mostra só 2 linhas (~70 caracteres no painel de 320 px): se a
// primeira ocorrência estiver além de MAX_START, o trecho começa
// CONTEXT_BEFORE caracteres antes dela (com "…"), para o termo ficar visível.
const MAX_START = 40;
const CONTEXT_BEFORE = 20;
const MAX_LENGTH = 160;

// Divide o texto em pedaços { text, match } prontos para renderizar.
export const buildSnippet = (rawText, term) => {
  const text = String(rawText || "").replace(/\s+/g, " ").trim();
  const ranges = findMatches(text, term);
  const first = ranges.length ? ranges[0] : [0, 0];

  let start = 0;
  if (first[0] > MAX_START) {
    start = first[0] - CONTEXT_BEFORE;
    // começa numa palavra inteira, se houver espaço perto
    const space = text.indexOf(" ", start);
    if (space !== -1 && space < first[0]) start = space + 1;
  }
  let end = Math.min(text.length, start + MAX_LENGTH);
  if (end < text.length) {
    const space = text.lastIndexOf(" ", end);
    if (space > first[1]) end = space;
  }

  const parts = [];
  let cursor = start;
  for (const [mStart, mEnd] of ranges) {
    if (mEnd <= start) continue;
    if (mStart >= end) break;
    const s = Math.max(mStart, start);
    const e = Math.min(mEnd, end);
    if (s > cursor) parts.push({ text: text.slice(cursor, s), match: false });
    parts.push({ text: text.slice(s, e), match: true });
    cursor = e;
  }
  if (cursor < end) parts.push({ text: text.slice(cursor, end), match: false });

  return {
    parts,
    leading: start > 0,
    trailing: end < text.length,
  };
};
