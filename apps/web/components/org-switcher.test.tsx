import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OrgSwitcher } from "./org-switcher";

const { mockPush, mockUseOrganizations, mockUseActiveOrganization, mockSetActiveOrg } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockUseOrganizations: vi.fn(),
  mockUseActiveOrganization: vi.fn(),
  mockSetActiveOrg: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/hooks/use-organization", () => ({
  useOrganizations: mockUseOrganizations,
  useActiveOrganization: mockUseActiveOrganization,
  useSetActiveOrganization: () => mockSetActiveOrg,
}));

const org1 = { id: "org1", name: "Acme", role: "owner" as const };
const org2 = { id: "org2", name: "Globex", role: "member" as const };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OrgSwitcher", () => {
  it("renders nothing when the user belongs to 0 or 1 organizations", () => {
    mockUseOrganizations.mockReturnValue([org1]);
    mockUseActiveOrganization.mockReturnValue(org1);

    const { container } = render(<OrgSwitcher />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the active organization's name and lists all organizations when there are 2+", () => {
    mockUseOrganizations.mockReturnValue([org1, org2]);
    mockUseActiveOrganization.mockReturnValue(org1);

    render(<OrgSwitcher />);

    // "Acme" appears in both the trigger button and the dropdown entry.
    expect(screen.getAllByText("Acme").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Globex")).toBeInTheDocument();
  });

  it("renders an em-dash when there is no active organization", () => {
    mockUseOrganizations.mockReturnValue([org1, org2]);
    mockUseActiveOrganization.mockReturnValue(null);

    render(<OrgSwitcher />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("switches the active organization and navigates to /workspaces when a different org is clicked", () => {
    mockUseOrganizations.mockReturnValue([org1, org2]);
    mockUseActiveOrganization.mockReturnValue(org1);

    render(<OrgSwitcher />);
    fireEvent.click(screen.getByText("Globex"));

    expect(mockSetActiveOrg).toHaveBeenCalledWith("org2");
    expect(mockPush).toHaveBeenCalledWith("/workspaces");
  });

  it("does nothing when clicking the already-active organization", () => {
    mockUseOrganizations.mockReturnValue([org1, org2]);
    mockUseActiveOrganization.mockReturnValue(org1);

    render(<OrgSwitcher />);
    // "Acme" appears in both the trigger button and the dropdown entry — click the dropdown one.
    const matches = screen.getAllByText("Acme");
    fireEvent.click(matches[matches.length - 1]!);

    expect(mockSetActiveOrg).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
