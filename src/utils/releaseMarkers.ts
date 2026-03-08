const MARKER_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "4K", pattern: /\b(4k|2160p|uhd)\b/i },
  { label: "HDR10+", pattern: /\bhdr10\+\b/i },
  { label: "HDR10", pattern: /\bhdr10\b/i },
  { label: "HDR", pattern: /\bhdr\b/i },
  { label: "DV", pattern: /\b(dolby[ .-]?vision|dv)\b/i },
  { label: "HEVC", pattern: /\b(hevc|x265|h\.?265)\b/i },
  { label: "AV1", pattern: /\bav1\b/i },
  { label: "x264", pattern: /\bx264\b/i },
  { label: "WEB-DL", pattern: /\bweb[ .-]?dl\b/i },
  { label: "WEBRip", pattern: /\bweb[ .-]?rip\b/i },
  { label: "BluRay", pattern: /\bblu[ .-]?ray\b/i },
  { label: "REMUX", pattern: /\bremux\b/i },
];

export const extractReleaseMarkers = (value?: string): string[] => {
  if (!value) return [];

  const detected: string[] = [];

  MARKER_PATTERNS.forEach(({ label, pattern }) => {
    if (pattern.test(value)) {
      detected.push(label);
    }
  });

  // Keep markers concise and avoid duplicates like HDR + HDR10+.
  if (detected.includes("HDR10+") && detected.includes("HDR")) {
    return detected.filter((item) => item !== "HDR");
  }

  if (detected.includes("HDR10") && detected.includes("HDR")) {
    return detected.filter((item) => item !== "HDR");
  }

  return detected;
};
