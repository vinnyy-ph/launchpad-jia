"use client";

import { useState } from "react";
import { Career } from "@/lib/types/projects";
import ArchiveCareerModal from "@/lib/components/CareerComponents/ArchiveCareerModal";
import RestoreCareerModal from "@/lib/components/CareerComponents/RestoreCareerModal";

/**
 * Controller for the Archive/Restore career confirmation modals.
 * Usage:
 *   const { openArchive, openRestore, modals } = useCareerArchiveModal(refreshList);
 *   ...menu onClick={() => openArchive(career)}...
 *   {modals}  // render once in the component tree
 */
export function useCareerArchiveModal(onChanged?: () => void) {
  const [archiveTarget, setArchiveTarget] = useState<Career | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Career | null>(null);

  const modals = (
    <>
      {archiveTarget && (
        <ArchiveCareerModal
          career={archiveTarget}
          onClose={() => setArchiveTarget(null)}
          onArchived={onChanged}
        />
      )}
      {restoreTarget && (
        <RestoreCareerModal
          career={restoreTarget}
          onClose={() => setRestoreTarget(null)}
          onRestored={onChanged}
        />
      )}
    </>
  );

  return {
    openArchive: (career: Career) => setArchiveTarget(career),
    openRestore: (career: Career) => setRestoreTarget(career),
    modals,
  };
}
