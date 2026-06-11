import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RedisPage from "./page";
import { I18nProvider } from "@/lib/i18n";
import type { RedisStatus } from "@/lib/api";

const fetchRedisStatus = vi.fn();

vi.mock("@/lib/api", () => ({
  fetchRedisStatus: (...args: unknown[]) => fetchRedisStatus(...args),
}));

function renderPage() {
  return render(
    <I18nProvider>
      <RedisPage />
    </I18nProvider>,
  );
}

const connectedStatus: RedisStatus = { connected: true, host: "redis.internal", port: 6379 };
const disconnectedStatus: RedisStatus = { connected: false, host: null, port: null };

beforeEach(() => {
  fetchRedisStatus.mockReset();
});

describe("RedisPage", () => {
  it("shows the connected status with host and port", async () => {
    fetchRedisStatus.mockResolvedValue(connectedStatus);
    renderPage();

    await waitFor(() => expect(screen.getByText("Connecté")).toBeInTheDocument());
    expect(screen.getByText("redis.internal")).toBeInTheDocument();
    expect(screen.getByText("6379")).toBeInTheDocument();
  });

  it("shows the disconnected status with placeholders for missing host/port", async () => {
    fetchRedisStatus.mockResolvedValue(disconnectedStatus);
    renderPage();

    await waitFor(() => expect(screen.getByText("Déconnecté")).toBeInTheDocument());
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("shows an error message when the request fails", async () => {
    fetchRedisStatus.mockRejectedValue(new Error("connection refused"));
    renderPage();

    await waitFor(() => expect(screen.getByText("connection refused")).toBeInTheDocument());
  });

  it("re-fetches the status when clicking the refresh button", async () => {
    fetchRedisStatus.mockResolvedValueOnce(connectedStatus).mockResolvedValueOnce(disconnectedStatus);
    renderPage();

    await waitFor(() => expect(screen.getByText("Connecté")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Actualiser/ }));

    await waitFor(() => expect(screen.getByText("Déconnecté")).toBeInTheDocument());
    expect(fetchRedisStatus).toHaveBeenCalledTimes(2);
  });
});
