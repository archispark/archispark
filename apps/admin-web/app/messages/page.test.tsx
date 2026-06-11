import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MessagesPage from "./page";
import { I18nProvider } from "@/lib/i18n";
import type { SiteMessages } from "@/lib/api";

const fetchSiteMessages = vi.fn();
const updateSiteMessages = vi.fn();

vi.mock("@/lib/api", () => ({
  fetchSiteMessages: (...args: unknown[]) => fetchSiteMessages(...args),
  updateSiteMessages: (...args: unknown[]) => updateSiteMessages(...args),
}));

function renderPage() {
  return render(
    <I18nProvider>
      <MessagesPage />
    </I18nProvider>,
  );
}

const initialMessages: SiteMessages = {
  login_message: "Demo: demo/demo123",
  login_message_enabled: true,
  banner_message: null,
  banner_message_enabled: false,
};

beforeEach(() => {
  fetchSiteMessages.mockReset();
  updateSiteMessages.mockReset();
});

describe("MessagesPage", () => {
  it("loads and displays the existing messages", async () => {
    fetchSiteMessages.mockResolvedValue(initialMessages);
    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue("Demo: demo/demo123")).toBeInTheDocument());
    expect(screen.getByText("Activé")).toBeInTheDocument();
    expect(screen.getByText("Désactivé")).toBeInTheDocument();
  });

  it("shows an error message when loading fails", async () => {
    fetchSiteMessages.mockRejectedValue(new Error("boom"));
    renderPage();

    await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument());
  });

  it("toggles the banner switch and edits the banner textarea", async () => {
    fetchSiteMessages.mockResolvedValue(initialMessages);
    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue("Demo: demo/demo123")).toBeInTheDocument());

    const bannerToggle = document.getElementById("banner-enabled")!;
    fireEvent.click(bannerToggle);

    await waitFor(() => expect(screen.getAllByText("Activé")).toHaveLength(2));

    const textareas = screen.getAllByRole("textbox");
    const bannerTextarea = textareas[1]!;
    fireEvent.change(bannerTextarea, { target: { value: "Maintenance ce soir." } });
    expect((bannerTextarea as HTMLTextAreaElement).value).toBe("Maintenance ce soir.");
  });

  it("saves successfully and shows a confirmation message", async () => {
    fetchSiteMessages.mockResolvedValue(initialMessages);
    updateSiteMessages.mockResolvedValue({ ok: true });
    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue("Demo: demo/demo123")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));

    await waitFor(() => expect(updateSiteMessages).toHaveBeenCalledWith({
      login_message: "Demo: demo/demo123",
      login_message_enabled: true,
      banner_message: null,
      banner_message_enabled: false,
    }));
    await waitFor(() => expect(screen.getByText("Enregistré.")).toBeInTheDocument());
  });

  it("shows an error message when saving fails", async () => {
    fetchSiteMessages.mockResolvedValue(initialMessages);
    updateSiteMessages.mockRejectedValue(new Error("save failed"));
    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue("Demo: demo/demo123")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));

    await waitFor(() => expect(screen.getByText("save failed")).toBeInTheDocument());
  });
});
