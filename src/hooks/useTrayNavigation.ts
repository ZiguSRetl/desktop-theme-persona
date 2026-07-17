import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function useTrayNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    void listen("navigate-settings", () => {
      navigate("/settings");
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [navigate]);
}
