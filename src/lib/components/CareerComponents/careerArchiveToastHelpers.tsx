"use client";

import React from "react";
import { toast } from "react-toastify";
import { successToast, errorToast } from "@/lib/Utils";
import { undoArchiveRequest } from "@/lib/utils/careerArchiveActions";
import CareerArchiveToast from "./CareerArchiveToast";

/** Base toast options shared across archive/restore toasts — mirrors Utils successToast pattern. */
const baseToastOptions = {
  position: "top-center" as const,
  pauseOnHover: true,
  hideProgressBar: false,
  closeOnClick: false,
  draggable: true,
  progress: undefined,
  closeButton: true,
  // Figma alert width is 480px (default react-toastify is 320); stay responsive on small screens.
  style: { width: 480, maxWidth: "calc(100vw - 32px)" },
};

/**
 * Show the archive toast (archive-drop or archive-nodrop variant).
 * Wires the Undo action: calls undoArchiveRequest(batchId), dismisses the toast,
 * calls onUndone(), then shows a brief success confirmation.
 */
export function showArchiveToast(opts: {
  careerTitle: string;
  dropped: boolean;
  batchId?: string;
  onUndone?: () => void;
}) {
  const variant = opts.dropped ? "archive-drop" : "archive-nodrop";

  // Captured below so Undo dismisses only ITS toast — a bare toast.dismiss()
  // clears every open toast (archive two careers quickly and one Undo would
  // eat the other career's toast, undo affordance included).
  let toastId: ReturnType<typeof toast> | undefined;

  const handleUndo = opts.batchId
    ? async () => {
        if (!opts.batchId) return;
        try {
          const data = await undoArchiveRequest(opts.batchId);
          if (data?.success) {
            if (toastId !== undefined) toast.dismiss(toastId);
            opts.onUndone?.();
            successToast("Archive undone.", 2500);
          } else {
            errorToast("Failed to undo archive.", 2500);
          }
        } catch (err: any) {
          errorToast(
            err?.response?.data?.error || err?.message || "Failed to undo archive.",
            2500
          );
        }
      }
    : undefined;

  toastId = toast(
    <CareerArchiveToast
      variant={variant}
      careerTitle={opts.careerTitle}
      onUndo={handleUndo}
    />,
    {
      ...baseToastOptions,
      autoClose: 10000,
    }
  );
}

/**
 * Show the restore toast (restore variant — no Undo).
 */
export function showRestoreToast(careerTitle: string) {
  toast(
    <CareerArchiveToast variant="restore" careerTitle={careerTitle} />,
    {
      ...baseToastOptions,
      autoClose: 10000,
    }
  );
}
