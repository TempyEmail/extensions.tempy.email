(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TempyUtils = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function getRemaining(expiresAt, nowMs) {
    const now = typeof nowMs === "number" ? nowMs : Date.now();
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  }

  function formatTimer(seconds, remainingFormatter, expiredLabel) {
    if (seconds <= 0) return expiredLabel || "Expired";
    const m = Math.floor(seconds / 60);
    const s = String(seconds % 60).padStart(2, "0");
    if (typeof remainingFormatter === "function") {
      return remainingFormatter(m, s);
    }
    return m + ":" + s + " remaining";
  }

  function extractOTP(content) {
    const text = content || "";
    const candidates = [];

    function addMatches(regex, codeFromMatch) {
      const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
      const re = new RegExp(regex.source, flags);
      for (const match of text.matchAll(re)) {
        const code = codeFromMatch(match);
        if (!code) continue;
        candidates.push({ index: match.index || 0, code });
      }
    }

    addMatches(/\bFB-\d{5}\b/gi, (m) => m[0]);
    addMatches(/\bG-\d{4,8}\b/gi, (m) => m[0]);
    addMatches(/(?:code|otp|pin|verification|verify|confirm)[:\s]*(\d{4,8})/gi, (m) => m[1]);
    addMatches(/(\d{4,8})\s*(?:is your|is the)/gi, (m) => m[1]);
    addMatches(/\b(?!20[2-3]\d\b)\d{4,8}\b/g, (m) => m[0]);

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => a.index - b.index);
    return { code: candidates[0].code };
  }

  return { getRemaining, formatTimer, extractOTP };
});
