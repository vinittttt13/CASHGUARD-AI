import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

// jsdom has no WebSocket by default in some configs; provide a minimal stub.
if (!(globalThis as any).WebSocket) {
  (globalThis as any).WebSocket = class {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = 0;
    onopen: ((e: any) => void) | null = null;
    onclose: ((e: any) => void) | null = null;
    onmessage: ((e: any) => void) | null = null;
    onerror: ((e: any) => void) | null = null;
    constructor(public url: string) {}
    send() {}
    close() {}
  };
}
