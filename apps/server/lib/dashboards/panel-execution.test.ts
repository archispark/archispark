import { describe, expect, it } from "vitest"
import type { PanelContent } from "./contracts"
import { coerceParameterValues, PanelExecutionError, resolveParameterValues } from "./panel-execution"

const parameters: PanelContent["parameters"] = [
  { name: "couche", label: "Couche", type: "enum", required: false, defaultValue: "Business", allowedValues: ["Application", "Business"] },
  { name: "seuil", label: "Seuil", type: "number", required: false },
  { name: "actif", label: "Actif", type: "boolean", required: false },
  { name: "nom", label: "Nom", type: "string", required: false },
]

describe("coerceParameterValues", () => {
  it("leaves enum/string values untouched", () => {
    expect(coerceParameterValues({ couche: "Application", nom: "x" }, parameters)).toEqual({
      couche: "Application",
      nom: "x",
    })
  })

  it("converts a valid number value", () => {
    expect(coerceParameterValues({ seuil: "42" }, parameters)).toEqual({ seuil: 42 })
  })

  it("rejects an invalid number value", () => {
    expect(() => coerceParameterValues({ seuil: "abc" }, parameters)).toThrow(PanelExecutionError)
    expect(() => coerceParameterValues({ seuil: "abc" }, parameters)).toThrow(/doit être un nombre/)
  })

  it.each(["true", "false"])("converts a valid boolean value (%s)", (raw) => {
    expect(coerceParameterValues({ actif: raw }, parameters)).toEqual({ actif: raw === "true" })
  })

  it("rejects an invalid boolean value", () => {
    expect(() => coerceParameterValues({ actif: "oui" }, parameters)).toThrow(/« true » ou « false »/)
  })

  it("ignores undeclared parameters and absent values", () => {
    expect(coerceParameterValues({ inconnu: "x" }, parameters)).toEqual({})
    expect(coerceParameterValues({}, parameters)).toEqual({})
  })
})

describe("resolveParameterValues", () => {
  it("applies default values", () => {
    expect(resolveParameterValues(parameters, {})).toEqual({ couche: "Business" })
  })

  it("rejects a missing required parameter", () => {
    const required: PanelContent["parameters"] = [{ name: "driverId", label: "Driver", type: "string", required: true }]
    expect(() => resolveParameterValues(required, {})).toThrow(/obligatoire/)
  })

  it("rejects a disallowed enum value", () => {
    expect(() => resolveParameterValues(parameters, { couche: "Inconnue" })).toThrow(/valeurs autorisées/)
  })
})
