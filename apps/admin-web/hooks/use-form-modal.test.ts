import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFormModal } from "./use-form-modal";

interface Item { id: string; name: string }

describe("useFormModal", () => {
  it("starts closed with no target and no error", () => {
    const { result } = renderHook(() => useFormModal<Item>());
    const [state] = result.current;
    expect(state.open).toBe(false);
    expect(state.target).toBeNull();
    expect(state.error).toBeNull();
    expect(state.isPending).toBe(false);
  });

  it("openNew opens the modal with a null target", () => {
    const { result } = renderHook(() => useFormModal<Item>());
    act(() => result.current[1].openNew());
    const [state] = result.current;
    expect(state.open).toBe(true);
    expect(state.target).toBeNull();
    expect(state.error).toBeNull();
  });

  it("openWith opens the modal with the given target", () => {
    const { result } = renderHook(() => useFormModal<Item>());
    const item: Item = { id: "1", name: "Item 1" };
    act(() => result.current[1].openWith(item));
    const [state] = result.current;
    expect(state.open).toBe(true);
    expect(state.target).toEqual(item);
    expect(state.error).toBeNull();
  });

  it("close resets open, error and isPending", () => {
    const { result } = renderHook(() => useFormModal<Item>());
    act(() => result.current[1].openNew());
    act(() => result.current[1].setError("boom"));
    act(() => result.current[1].setPending(true));
    act(() => result.current[1].close());
    const [state] = result.current;
    expect(state.open).toBe(false);
    expect(state.error).toBeNull();
    expect(state.isPending).toBe(false);
  });

  it("setError sets the error message", () => {
    const { result } = renderHook(() => useFormModal<Item>());
    act(() => result.current[1].setError("oops"));
    expect(result.current[0].error).toBe("oops");
  });

  it("setPending sets the isPending flag", () => {
    const { result } = renderHook(() => useFormModal<Item>());
    act(() => result.current[1].setPending(true));
    expect(result.current[0].isPending).toBe(true);
  });

  describe("run()", () => {
    it("on success: closes the modal, clears error and isPending", async () => {
      const { result } = renderHook(() => useFormModal<Item>());
      act(() => result.current[1].openNew());

      const fn = vi.fn().mockResolvedValue(undefined);
      await act(async () => {
        await result.current[1].run(fn);
      });

      expect(fn).toHaveBeenCalled();
      const [state] = result.current;
      expect(state.open).toBe(false);
      expect(state.error).toBeNull();
      expect(state.isPending).toBe(false);
    });

    it("on failure: sets error message, clears isPending, and keeps the modal open", async () => {
      const { result } = renderHook(() => useFormModal<Item>());
      act(() => result.current[1].openNew());

      const fn = vi.fn().mockRejectedValue(new Error("Something went wrong"));
      await act(async () => {
        await result.current[1].run(fn);
      });

      const [state] = result.current;
      expect(state.open).toBe(true);
      expect(state.error).toBe("Something went wrong");
      expect(state.isPending).toBe(false);
    });
  });
});
