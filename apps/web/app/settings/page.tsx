"use client";
import { useT } from "@/lib/i18n";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  fetchWorkspaces,
  updateWorkspaceApi,
  deleteWorkspaceApi,
  exportModelUrl,
  importModel,
  type WorkspaceInfo,
} from "@/lib/api";
import { useRouter } from "next/navigation";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Settings as SettingsIcon, Upload, Download, Trash2 } from "lucide-react";
import { useDropzone } from "react-dropzone";

type Tab = "general" | "import-export";

export default function SettingsPage() {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>("general");

  return (
    <div className="p-7 space-y-5">
      <div>
        <h1 className="text-lg font-semibold">{t("settings.title")}</h1>
        <p className="text-muted-foreground text-[13px] mt-0.5">
          {t("settings.desc")}
        </p>
      </div>

      <div className="flex items-center gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("general")}
          className={`flex items-center gap-2 px-3 py-2 text-[13px] border-b-2 transition-colors ${
            tab === "general"
              ? "border-primary text-foreground font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <SettingsIcon className="size-3.5" />
          {t("settings.tab_general")}
        </button>
        <button
          type="button"
          onClick={() => setTab("import-export")}
          className={`flex items-center gap-2 px-3 py-2 text-[13px] border-b-2 transition-colors ${
            tab === "import-export"
              ? "border-primary text-foreground font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Upload className="size-3.5" />
          {t("settings.tab_import_export")}
        </button>
      </div>

      {tab === "general" && <GeneralTab />}
      {tab === "import-export" && <ImportExportTab />}
    </div>
  );
}

function ImportExportTab() {
  const { t } = useT();
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

function GeneralTab() {
  const { t } = useT();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const active = useMemo(() => workspaces.find((w) => w.active), [workspaces]);

  const load = useCallback(() => {
    setLoading(true);
    fetchWorkspaces()
      .then((ws) => {
        setWorkspaces(ws);
        const a = ws.find((w) => w.active);
        if (a) {
          setName(a.name);
          setDescription("");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!active) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      await updateWorkspaceApi(active.id, { name });
      setSavedMsg("Enregistré.");
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!active) return;
    setDeleting(true);
    try {
      await deleteWorkspaceApi(active.id);
      setDeleteOpen(false);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="text-muted-foreground text-sm">Chargement…</div>;
  }

  if (!active) {
    return <div className="text-muted-foreground text-sm">Aucun workspace actif.</div>;
  }

  return (
    <div className="space-y-4 max-w-xl">
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      {savedMsg && (
        <div className="text-sm text-emerald-700 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-3 py-2">
          {savedMsg}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ws-name">Nom du workspace</Label>
        <Input
          id="ws-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ws-desc">Description</Label>
        <textarea
          id="ws-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="text-sm px-3 py-2 border border-border rounded-md bg-background text-foreground resize-y"
          placeholder="Description (non persistée pour l'instant)"
        />
        <p className="text-[11px] text-muted-foreground">
          La description sera persistée dans une prochaine version (API non disponible).
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Chemin</Label>
        <div className="text-[12px] text-muted-foreground font-mono">{active.path}</div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger render={<Button variant="destructive" />}>
            <Trash2 className="size-4" /> Supprimer le workspace
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Supprimer le workspace</DialogTitle>
              <DialogDescription>
                Supprimer <strong>{active.name}</strong> ? Irréversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Suppression…" : "Supprimer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

    </div>
  );
}

