import { describe, it, expect } from "vitest";
import { escXml } from "./xml-escape.js";

describe("escXml", () => {
  it("returns empty string for null", () => {
    expect(escXml(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(escXml(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(escXml("")).toBe("");
  });

  it("escapes ampersands", () => {
    expect(escXml("a & b")).toBe("a &amp; b");
  });

  it("escapes less-than", () => {
    expect(escXml("a < b")).toBe("a &lt; b");
  });

  it("escapes greater-than", () => {
    expect(escXml("a > b")).toBe("a &gt; b");
  });

  it("escapes double quotes", () => {
    expect(escXml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("escapes multiple special characters in one string", () => {
    expect(escXml('<tag attr="val" & more>')).toBe(
      "&lt;tag attr=&quot;val&quot; &amp; more&gt;",
    );
  });

  it("leaves plain text unchanged", () => {
    expect(escXml("hello world")).toBe("hello world");
  });
});
