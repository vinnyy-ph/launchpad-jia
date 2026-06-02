"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@context/AppContext";
import { useRecruiterContext } from "@context/RecruiterContext";
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
import { AlertCircle, CheckCircle } from "@untitledui/icons";
import { ButtonProps } from "@components/ui/button/Button";

interface ActionConfig {
  variant: "warning" | "success";
  icon: React.ReactNode;
  title: string;
  subtext: string;
  buttonText: string;
  cancelText: string;
  buttonVariant: ButtonProps["variant"];
}

export default function CareerActionModal({
  action,
  onAction,
  onValidate,
  formType = "add",
}: {
  action: string;
  onAction: (action: string) => void;
  onValidate?: () => boolean;
  formType?: "add" | "edit";
}) {
  const router = useRouter();
  const { orgID } = useAppContext();
  const { hasUnsavedChanges, setHasUnsavedChanges, setModalType } = useRecruiterContext();

  const isDiscard = hasUnsavedChanges || formType === "edit";

  const actions = useMemo<Record<string, ActionConfig>>(() => ({
    active: {
      variant: "success",
      icon: <CheckCircle size={24} />,
      title: "Save and Publish Career",
      subtext:
        "Are you ready to publish this career? Once published, applicants will be able to view and apply to this opportunity.",
      buttonText: "Save & Publish",
      cancelText: "Cancel",
      buttonVariant: "primary",
    },
    inactive: {
      variant: "warning",
      icon: <AlertCircle size={24} />,
      title: isDiscard
        ? formType === "edit" ? "Discard Changes?" : "Discard this Career?"
        : "Save without publishing",
      subtext: isDiscard
        ? formType === "edit"
          ? "Are you sure you want to discard career updates without saving your changes?"
          : "Are you sure you want to discard career creation without saving your changes?"
        : "Are you sure you want to save this career without publishing it?",
      buttonText: isDiscard ? "Discard" : "Save",
      cancelText: isDiscard ? "Save as Draft" : "Cancel",
      buttonVariant: isDiscard ? "tertiary" : "primary",
    },
    unpublish: {
      variant: "warning",
      icon: <AlertCircle size={24} />,
      title: "Unpublish Career",
      subtext:
        "Are you sure you want to unpublish this career? Once unpublished, applicants will not be able to view and apply to this opportunity.",
      buttonText: "Unpublish",
      cancelText: "Cancel",
      buttonVariant: "primary",
    },
    publish: {
      variant: "success",
      icon: <CheckCircle size={24} />,
      title: "Publish Career",
      subtext:
        "Are you sure you want to publish this career? Once published, applicants will be able to view and apply to this opportunity.",
      buttonText: "Publish",
      cancelText: "Cancel",
      buttonVariant: "primary",
    },
  }), [isDiscard, formType]);

  const config = actions[action];

  const handleSaveCareerEvent = useCallback(() => {
    if (action !== "active") return;
    try {
      if (
        typeof window !== "undefined" &&
        typeof (window as any)?.gtag === "function"
      ) {
        (window as any)?.gtag?.("event", "career_created");
      }
    } catch (error) {
      console.error("Error triggering career created event", error);
    }
  }, [action]);

  const handleCancelClick = useCallback(() => {
    if (action === "inactive" && isDiscard) {
      onAction("inactive");
      return;
    }
    onAction("");
  }, [action, isDiscard, onAction]);

  const handleSaveClick = useCallback(() => {
    if (action === "inactive" && isDiscard) {
      onAction("");
      setHasUnsavedChanges(false);
      setModalType(null);
      router.push(`/recruiter-dashboard/careers?orgID=${orgID}`);
      return;
    }
    if (onValidate && !onValidate()) return;
    handleSaveCareerEvent();
    onAction(action);
  }, [action, isDiscard, orgID, router, onValidate, onAction, handleSaveCareerEvent, setHasUnsavedChanges, setModalType]);

  if (!config) return null;

  return (
    <Dialog open={action !== ""} onOpenChange={() => onAction("")}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogIcon variant={config.variant}>
            {config.icon}
          </DialogIcon>
          <DialogTextGroup>
            <DialogTitle>{config.title}</DialogTitle>
            <DialogDescription>{config.subtext}</DialogDescription>
          </DialogTextGroup>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="secondary"
            label={config.cancelText}
            onClick={handleCancelClick}
          />
          <Button
            id="save-career-button"
            variant={config.buttonVariant}
            label={config.buttonText}
            onClick={handleSaveClick}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
