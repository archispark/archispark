import { describe, it, expect } from "vitest"
import { ValidationError } from "./errors"
import { sanitizeSvg } from "./svg-sanitize"

const CLEAN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs><linearGradient id="g"><stop offset="0" stop-color="#fff" /></linearGradient></defs>
  <g fill="url(#g)"><path d="M0 0h32v32H0z" /></g>
  <use href="#g" />
</svg>`

describe("sanitizeSvg", () => {
  it("accepts a clean svg and returns it unchanged", () => {
    expect(sanitizeSvg(CLEAN_SVG, "clean.svg")).toBe(CLEAN_SVG)
  })

  it("rejects a non-xml document", () => {
    expect(() => sanitizeSvg("not xml <<<", "bad.svg")).toThrow(ValidationError)
  })

  it("rejects a document without an <svg> root", () => {
    expect(() => sanitizeSvg("<div>hi</div>", "bad.svg")).toThrow(
      ValidationError
    )
  })

  it("rejects a <script> tag", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`
    expect(() => sanitizeSvg(svg, "evil.svg")).toThrow(ValidationError)
  })

  it("rejects a <foreignObject> tag", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml">hi</body></foreignObject></svg>`
    expect(() => sanitizeSvg(svg, "evil.svg")).toThrow(ValidationError)
  })

  it("rejects an onload attribute", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect/></svg>`
    expect(() => sanitizeSvg(svg, "evil.svg")).toThrow(ValidationError)
  })

  it("rejects an onclick attribute on a nested element", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="alert(1)"/></svg>`
    expect(() => sanitizeSvg(svg, "evil.svg")).toThrow(ValidationError)
  })

  it("rejects an external href", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.test/x.png"/></svg>`
    expect(() => sanitizeSvg(svg, "evil.svg")).toThrow(ValidationError)
  })

  it("rejects a javascript: xlink:href", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><a xlink:href="javascript:alert(1)"><rect/></a></svg>`
    expect(() => sanitizeSvg(svg, "evil.svg")).toThrow(ValidationError)
  })

  it("accepts a data:image href", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,AAAA"/></svg>`
    expect(() => sanitizeSvg(svg, "ok.svg")).not.toThrow()
  })
})
