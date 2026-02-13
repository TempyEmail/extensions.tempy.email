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

  function extractOTP(content, labelFormatter) {
    const text = content || "";
    const label = typeof labelFormatter === "function"
      ? labelFormatter
      : (code) => "OTP: " + code;

    const contextMatch = text.match(/(?:code|otp|pin|verification|verify|confirm)[:\s]*(\d{4,8})/i)
      || text.match(/(\d{4,8})\s*(?:is your|is the)/i);

    if (contextMatch) return label(contextMatch[1]);

    const matches = text.match(/\b(?!20[2-3]\d\b)\d{4,8}\b/g);
    if (matches && matches.length > 0) {
      return label(matches[0]);
    }

    return null;
  }

  return { getRemaining, formatTimer, extractOTP };
});
