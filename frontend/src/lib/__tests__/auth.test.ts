import { describe, it, expect, beforeEach } from "vitest";
import {
  getToken,
  setToken,
  getRefreshToken,
  setRefreshToken,
  clearAuth,
  isTokenExpired,
  isAuthenticated,
} from "@/lib/auth";

function makeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.sig`;
}

describe("lib/auth token storage", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips the access and refresh tokens on the expected keys", () => {
    setToken("access-1");
    setRefreshToken("refresh-1");
    expect(getToken()).toBe("access-1");
    expect(getRefreshToken()).toBe("refresh-1");
    expect(localStorage.getItem("accessToken")).toBe("access-1");
    expect(localStorage.getItem("refreshToken")).toBe("refresh-1");
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("clearAuth removes both tokens", () => {
    setToken("a");
    setRefreshToken("b");
    clearAuth();
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});

describe("lib/auth expiry", () => {
  beforeEach(() => localStorage.clear());

  it("treats a future exp as not expired and a past exp as expired", () => {
    const future = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    const past = makeJwt({ exp: Math.floor(Date.now() / 1000) - 10 });
    expect(isTokenExpired(future)).toBe(false);
    expect(isTokenExpired(past)).toBe(true);
  });

  it("treats a malformed token as expired", () => {
    expect(isTokenExpired("not-a-jwt")).toBe(true);
  });

  it("isAuthenticated reflects the stored token", () => {
    expect(isAuthenticated()).toBe(false);
    setToken(makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    expect(isAuthenticated()).toBe(true);
    setToken(makeJwt({ exp: Math.floor(Date.now() / 1000) - 5 }));
    expect(isAuthenticated()).toBe(false);
  });
});
