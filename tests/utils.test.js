const test = require("node:test");
const assert = require("node:assert/strict");

const { getRemaining, formatTimer, extractOTP } = require("../popup/utils.js");

test("getRemaining returns 0 for expired timestamps", () => {
  const now = Date.UTC(2026, 1, 13, 0, 0, 0);
  const past = new Date(Date.UTC(2026, 1, 12, 23, 59, 0)).toISOString();
  assert.equal(getRemaining(past, now), 0);
});

test("getRemaining returns seconds until expiry", () => {
  const now = Date.UTC(2026, 1, 13, 0, 0, 0);
  const future = new Date(Date.UTC(2026, 1, 13, 0, 1, 40)).toISOString();
  assert.equal(getRemaining(future, now), 100);
});

test("formatTimer uses formatter for remaining time", () => {
  const result = formatTimer(125, (m, s) => `${m}:${s} remaining`, "Expired");
  assert.equal(result, "2:05 remaining");
});

test("formatTimer uses expired label for zero or negative", () => {
  const result = formatTimer(0, (m, s) => `${m}:${s} remaining`, "Expired");
  assert.equal(result, "Expired");
});

test("extractOTP finds context-based code", () => {
  const label = (code) => `OTP: ${code}`;
  const result = extractOTP("Your verification code: 123456", label);
  assert.equal(result, "OTP: 123456");
});

test("extractOTP falls back to standalone digits", () => {
  const label = (code) => `OTP: ${code}`;
  const result = extractOTP("Use 98765 to continue", label);
  assert.equal(result, "OTP: 98765");
});

test("extractOTP ignores year-like numbers", () => {
  const label = (code) => `OTP: ${code}`;
  const result = extractOTP("This was in 2024", label);
  assert.equal(result, null);
});
