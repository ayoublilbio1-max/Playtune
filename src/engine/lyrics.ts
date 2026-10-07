/** One lyrics line; `timeMs` is null for plain (not synced) lyrics. */
export type LyricLine = { timeMs: number | null; text: string };

export type ParsedLyrics = {
  synced: boolean;
  lines: LyricLine[];
};

const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const META_TAG = /^\[(ar|ti|al|au|by|length|re|ve|offset|#):?[^\]]*\]$/i;

function tagToMs(min: string, sec: string, frac?: string) {
  const fraction = frac ? Number(frac.padEnd(3, "0").slice(0, 3)) : 0;
  return Number(min) * 60_000 + Number(sec) * 1000 + fraction;
}

/**
 * Reads LRC-style lyrics ("[01:23.45] line", several time tags per line allowed, [offset:+200]).
 * If at least 3 lines have time tags, the lyrics are "synced" and sorted by time.
 * Otherwise every line is kept as plain text.
 */
export function parseLyrics(raw: string): ParsedLyrics {
  const offsetMatch = raw.match(/\[offset:\s*([+-]?\d+)\s*\]/i);
  const offset = offsetMatch ? Number(offsetMatch[1]) : 0;

  const timed: LyricLine[] = [];
  const plain: LyricLine[] = [];

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (META_TAG.test(line)) continue;
    const tags = [...line.matchAll(TIME_TAG)];
    const text = line.replace(TIME_TAG, "").trim();
    if (tags.length) {
      for (const tag of tags) {
        timed.push({
          timeMs: Math.max(0, tagToMs(tag[1], tag[2], tag[3]) - offset),
          text,
        });
      }
    }
    plain.push({ timeMs: null, text });
  }

  if (timed.length >= 3) {
    timed.sort((a, b) => (a.timeMs ?? 0) - (b.timeMs ?? 0));
    return { synced: true, lines: timed };
  }

  // Plain lyrics: drop leading / trailing empty lines, keep blank lines between verses.
  while (plain.length && !plain[0].text) plain.shift();
  while (plain.length && !plain[plain.length - 1].text) plain.pop();
  return { synced: false, lines: plain };
}

/** Index of the line being sung at `positionMs` (-1 before the first line). */
export function currentLineIndex(
  lines: LyricLine[],
  positionMs: number,
): number {
  let index = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].timeMs;
    if (t === null || t > positionMs) break;
    index = i;
  }
  return index;
}
