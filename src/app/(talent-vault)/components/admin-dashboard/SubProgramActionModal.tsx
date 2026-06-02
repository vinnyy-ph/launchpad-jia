"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogIcon,
  DialogTextGroup,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  } from "@components/ui";
import { AlertCircle } from "@untitledui/icons";

interface SubProgramActionModalProps {
  action: string;
  onAction: (action: string) => void;
}

export default function SubProgramActionModal({
  action,
  onAction,
}: SubProgramActionModalProps) {

  return (
    <Dialog open={action === "exit"} onOpenChange={() => onAction("")}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogIcon variant="warning">
            <AlertCircle size={24} />
          </DialogIcon>
          <DialogTextGroup>
            <DialogTitle>Discard this Program?</DialogTitle>
            <DialogDescription>
              Are you sure you want to exit? Any unsaved changes will be lost.
            </DialogDescription>
          </DialogTextGroup>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="secondary"
            label="Cancel"
            onClick={() => onAction("")}
          />
          <Button
            variant="tertiary"
            label="Discard"
            onClick={() => onAction("exit")}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
