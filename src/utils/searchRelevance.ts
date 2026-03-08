const OPTIONAL_QUERY_TOKENS = new Set([
  "720p",
  "1080p",
  "2160p",
  "4k",
  "uhd",
  "hdr",
  "hdr10",
  "hdr10+",
  "dv",
  "x264",
  "x265",
  "h264",
  "h265",
  "hevc",
  "av1",
  "webrip",
  "webdl",
  "web-dl",
  "bluray",
  "brrip",
  "bdrip",
]);

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const extractSearchTokens = (query: string): string[] => {
  const normalized = normalize(query);
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
};

export const isRelevantSearchResult = (
  query: string,
  candidate: string
): boolean => {
  const tokens = extractSearchTokens(query);
  if (tokens.length === 0) return true;

  const haystack = normalize(candidate);
  if (!haystack) return false;

  // Full normalized phrase match is always relevant.
  const normalizedQuery = normalize(query);
  if (normalizedQuery && haystack.includes(normalizedQuery)) {
    return true;
  }

  const coreTokens = tokens.filter((token) => !OPTIONAL_QUERY_TOKENS.has(token));
  const tokenSet = new Set(haystack.split(" "));

  if (coreTokens.length > 0) {
    // Make the user text matter: every core token must exist.
    return coreTokens.every((token) => tokenSet.has(token));
  }

  // If query is only optional tags (e.g. "2160p x265"), require at least one.
  return tokens.some((token) => tokenSet.has(token));
};
