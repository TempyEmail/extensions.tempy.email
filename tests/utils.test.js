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
  const result = extractOTP("Your verification code: 123456");
  assert.equal(result.code, "123456");
});

test("extractOTP falls back to standalone digits", () => {
  const result = extractOTP("Use 98765 to continue");
  assert.equal(result.code, "98765");
});

test("extractOTP finds Facebook code format", () => {
  const result = extractOTP("Your Facebook code is FB-12345.");
  assert.equal(result.code, "FB-12345");
});

test("extractOTP finds Google code format", () => {
  const result = extractOTP("Use G-654321 to verify.");
  assert.equal(result.code, "G-654321");
});

test("extractOTP uses first occurrence in the body", () => {
  const result = extractOTP("Code 1111 appears before FB-22222 and 3333.");
  assert.equal(result.code, "1111");
});

test("extractOTP ignores year-like numbers", () => {
  const result = extractOTP("This was in 2024");
  assert.equal(result, null);
});
