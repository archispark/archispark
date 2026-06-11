"use client";
import { useT } from "@/lib/i18n";

import { useState } from "react";
import { exportModelUrl, importModel } from "@/lib/api";
import { Label } from "@workspace/ui/components/label";
import { Upload, Download } from "lucide-react";
import { useDropzone } from "react-dropzone";

export default function SettingsPage() {
  const { t } = useT();

  return (
    <div className="p-7 space-y-5">
      <div>
        <h1 className="text-lg font-semibold">{t("settings.title")}</h1>
        <p className="text-muted-foreground text-[13px] mt-0.5">
          {t("settings.desc")}
        </p>
      </div>

      <ImportExportTab />
    </div>
  );
}

function ImportExportTab() {
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(exportModelUrl, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="?([^";\n]+)"?/)?.[1] ?? "model.xml";
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportError(null);
    setImportSuccess(null);
    try {
      const info = await importModel(file);
      setImportSuccess(`Modèle « ${info.name} » importé — ${info.element_count} éléments, ${info.view_count} vues.`);
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "text/xml": [".xml"], "application/xml": [".xml"] },
    maxFiles: 1,
    disabled: importing,
    onDropAccepted: ([file]) => { if (file) handleImportFile(file); },
  });

  return (
    <div className="space-y-6 max-w-xl">
      {importError && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{importError}</div>
      )}
      {importSuccess && (
        <div className="text-sm text-emerald-700 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-3 py-2">{importSuccess}</div>
      )}

      <div className="space-y-2">
        <Label>Importer un modèle</Label>
        <p className="text-[12px] text-muted-foreground">Fichier Open Exchange Format (.xml). Remplace le workspace actif.</p>
        <div
          {...getRootProps()}
          className={`flex items-center justify-center gap-3 border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
            importing ? "border-primary/50 opacity-60 pointer-events-none"
            : isDragActive ? "border-primary bg-primary/5 text-primary"
            : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="size-5 shrink-0" />
          <div className="text-center">
            <p className="text-sm font-medium">
              {importing ? "Importation en cours…" : isDragActive ? "Déposez le fichier ici…" : "Cliquez ou déposez un fichier"}
            </p>
            <p className="text-[11px] opacity-70 mt-0.5">.xml (AOEF)</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Exporter le modèle</Label>
        <p className="text-[12px] text-muted-foreground">Télécharge le modèle actif au format Open Exchange XML.</p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-colors disabled:opacity-60 disabled:pointer-events-none"
        >
          <Download className="size-4" />
          {exporting ? "Exportation…" : "Exporter le modèle (.xml)"}
        </button>
      </div>
    </div>
  );
}
