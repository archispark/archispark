"use client"

import { type ElementOut, type Property } from "@/lib/api"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@workspace/ui/components/select"

export function ElementSelectField({
  value,
  onChange,
  placeholder,
  allElements,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  allElements: ElementOut[]
}) {
  const selected = allElements.find((e) => e.identifier === value)
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
      <SelectTrigger>
        {selected ? (
          <span className="truncate">
            {selected.name || selected.identifier}{" "}
            <span className="text-muted-foreground">({selected.type})</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </SelectTrigger>
      <SelectContent>
        {allElements.map((el) => (
          <SelectItem key={el.identifier} value={el.identifier}>
            {el.name || el.identifier} ({el.type})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export interface RelationshipFormFields {
  type: string
  onTypeChange: (v: string) => void
  source: string
  onSourceChange: (v: string) => void
  target: string
  onTargetChange: (v: string) => void
  name: string
  onNameChange: (v: string) => void
  doc: string
  onDocChange: (v: string) => void
  props: Property[]
  onPropsChange: (p: Property[]) => void
  types: string[]
  allElements: ElementOut[]
}
