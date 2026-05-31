"use client";
import { useT } from "@/lib/i18n";

import { useEffect, useState } from "react";
import { fetchPropertyDefinitions, type Property, type PropertyDefinitionOut } from "@/lib/api";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@workspace/ui/components/select";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  value: Property[];
  onChange: (props: Property[]) => void;
}

export function PropertiesEditor({ value, onChange }: Props) {
  const { t } = useT();
  const [definitions, setDefinitions] = useState<PropertyDefinitionOut[]>([]);
  const [addRef, setAddRef] = useState("");
  const [addVal, setAddVal] = useState("");

  useEffect(() => {
    fetchPropertyDefinitions().then(setDefinitions).catch(() => {});
  }, []);

  const getName = (ref: string) =>
    definitions.find((d) => d.identifier === ref)?.name ?? ref;

  const usedRefs = new Set(value.map((p) => p.property_definition_ref));
  const available = definitions.filter((d) => !usedRefs.has(d.identifier));

  function updateValue(ref: string, newVal: string) {
    onChange(value.map((p) => p.property_definition_ref === ref ? { ...p, value: newVal } : p));
  }

  function remove(ref: string) {
    onChange(value.filter((p) => p.property_definition_ref !== ref));
  }

  function add() {
    if (!addRef) return;
    onChange([...value, { property_definition_ref: addRef, value: addVal }]);
    setAddRef("");
    setAddVal("");
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {value.map((p) => (
            <div key={p.property_definition_ref} className="flex items-center gap-2">
              <span className="text-[12px] text-muted-foreground w-32 shrink-0 truncate" title={getName(p.property_definition_ref)}>
                {getName(p.property_definition_ref)}
              </span>
              <Input
                className="h-7 text-[12px]"
                value={p.value}
                onChange={(e) => updateValue(p.property_definition_ref, e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => remove(p.property_definition_ref)}
                aria-label={t("common.delete")}
              >
                <Trash2 className="size-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <Select value={addRef} onValueChange={(v) => setAddRef(v ?? "")}>
            <SelectTrigger className="h-7 text-[12px] flex-1">
              {addRef
                ? <span className="flex flex-1 text-left truncate">{definitions.find((d) => d.identifier === addRef)?.name ?? addRef}</span>
                : <SelectValue placeholder={t("properties.property_placeholder")} />
              }
            </SelectTrigger>
            <SelectContent>
              {available.map((d) => (
                <SelectItem key={d.identifier} value={d.identifier}>
                  {d.name}
                  <span className="ml-1.5 text-[10px] text-muted-foreground">{d.type}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="h-7 text-[12px] flex-1"
            placeholder={t("properties.value_placeholder")}
            value={addVal}
            onChange={(e) => setAddVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button variant="ghost" size="icon-xs" onClick={add} disabled={!addRef} aria-label="Ajouter">
            <Plus className="size-3.5" />
          </Button>
        </div>
      )}

      {available.length === 0 && value.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic">
          Aucune définition de propriété. Créez-en dans Modèle → Propriétés.
        </p>
      )}
    </div>
  );
}
