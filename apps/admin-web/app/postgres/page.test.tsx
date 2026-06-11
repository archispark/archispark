import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PostgresPage from "./page";
import { I18nProvider } from "@/lib/i18n";
import type { PostgresStatus } from "@/lib/api";

const fetchPostgresStatus = vi.fn();

vi.mock("@/lib/api", () => ({
  fetchPostgresStatus: (...args: unknown[]) => fetchPostgresStatus(...args),
}));

function renderPage() {
  return render(
    <I18nProvider>
      <PostgresPage />
    </I18nProvider>,
  );
}

const connectedStatus: PostgresStatus = {
  connected: true,
  host: "pg.internal",
  port: 5432,
  database: "archispark",
  version: "PostgreSQL 16.2",
};

const disconnectedStatus: PostgresStatus = {
  connected: false,
  host: null,
  port: null,
  database: null,
  version: null,
};

beforeEach(() => {
  fetchPostgresStatus.mockReset();
});

describe("PostgresPage", () => {
  it("shows the connected status with host, port, database and version", async () => {
    fetchPostgresStatus.mockResolvedValue(connectedStatus);
    renderPage();

    await waitFor(() => expect(screen.getByText("Connecté")).toBeInTheDocument());
    expect(screen.getByText("pg.internal")).toBeInTheDocument();
    expect(screen.getByText("5432")).toBeInTheDocument();
    expect(screen.getByText("archispark")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL 16.2")).toBeInTheDocument();
  });

  it("shows the disconnected status with placeholders for missing fields", async () => {
    fetchPostgresStatus.mockResolvedValue(disconnectedStatus);
    renderPage();

    await waitFor(() => expect(screen.getByText("Déconnecté")).toBeInTheDocument());
    expect(screen.getAllByText("—")).toHaveLength(4);
  });

  it("shows an error message when the request fails", async () => {
    fetchPostgresStatus.mockRejectedValue(new Error("connection refused"));
    renderPage();

    await waitFor(() => expect(screen.getByText("connection refused")).toBeInTheDocument());
  });

  it("re-fetches the status when clicking the refresh button", async () => {
    fetchPostgresStatus.mockResolvedValueOnce(connectedStatus).mockResolvedValueOnce(disconnectedStatus);
    renderPage();

    await waitFor(() => expect(screen.getByText("Connecté")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Actualiser/ }));

    await waitFor(() => expect(screen.getByText("Déconnecté")).toBeInTheDocument());
    expect(fetchPostgresStatus).toHaveBeenCalledTimes(2);
  });
});
