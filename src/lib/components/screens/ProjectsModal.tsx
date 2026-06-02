"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Field, Modal, Select, Stack, Textarea } from "@/lib/components/ui";
import { useDisclosure } from "@/lib/components/ui/hooks";
import styles from "./form-modal.module.scss";

export interface ProjectItem {
  id: string;
  name: string;
  isCurrent: boolean;
  startDate: { month: string; year: string };
  endDate: { month: string; year: string };
  description: string;
}

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: ProjectItem) => void;
  onDelete?: (id: string, e?: React.MouseEvent) => void;
  initialData?: ProjectItem | null;
}

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const years = Array.from({ length: 50 }, (_, i) =>
  (new Date().getFullYear() - i).toString(),
);

function createEmptyProject(): ProjectItem {
  return {
    id: Date.now().toString(),
    name: "",
    isCurrent: false,
    startDate: { month: "", year: "" },
    endDate: { month: "", year: "" },
    description: "",
  };
}

function toSelectData(options: string[]) {
  return options.map((option) => ({ value: option, label: option }));
}

export default function ProjectsModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
}: ProjectsModalProps) {
  const [opened, { open, close }] = useDisclosure(isOpen);
  const [project, setProject] = useState<ProjectItem>(() => createEmptyProject());
  const monthOptions = useMemo(() => toSelectData(months), []);
  const yearOptions = useMemo(() => toSelectData(years), []);

  useEffect(() => {
    if (isOpen) {
      open();
      return;
    }

    close();
  }, [close, isOpen, open]);

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setProject(initialData);
      return;
    }

    setProject(createEmptyProject());
  }, [initialData, isOpen]);

  function handleClose() {
    close();
    onClose();
  }

  function handleSave() {
    if (!project.name.trim()) {
      alert("Project name is required");
      return;
    }

    onSave(project);
    handleClose();
  }

  function handleDelete() {
    if (!onDelete || !project.id) return;

    onDelete(project.id);
    handleClose();
  }

  function updateProject<K extends keyof ProjectItem>(
    field: K,
    value: ProjectItem[K],
  ) {
    setProject((current) => ({ ...current, [field]: value }));
  }

  function updateDate(
    type: "startDate" | "endDate",
    field: "month" | "year",
    value: string,
  ) {
    setProject((current) => ({
      ...current,
      [type]: { ...current[type], [field]: value },
    }));
  }

  const descriptionCharactersLeft = 2000 - (project.description?.length ?? 0);

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      size={800}
      radius={16}
      classNames={{
        body: styles.modalBody,
        content: styles.modalContent,
        header: styles.modalHeader,
        title: styles.modalTitle,
      }}
      title={
        <span className={styles.titleBlock}>
          <span className={styles.heading}>
            {initialData ? "Edit Project" : "Add Project"}
          </span>
          <span className={styles.subtitle}>
            Showcase projects that demonstrate your skills, impact, or
            problem-solving approach.
          </span>
        </span>
      }
      closeButtonLabel="Close projects modal"
    >
      <div className={styles.formLayout}>
        <div className={styles.fields}>
          <p className={styles.requiredHint}>
            <span className={styles.requiredHintAsterisk}>*</span> Indicates required
          </p>

          <Field
            label="Project name"
            withAsterisk
            placeholder="E.g. Mobile Wellness App Redesign"
            value={project.name}
            onChange={(event) => updateProject("name", event.target.value)}
          />

          <div className={styles.currentProject}>
            <Checkbox
              checked={project.isCurrent}
              label="I am currently working on this project"
              onCheckedChange={(checked) => updateProject("isCurrent", checked)}
            />
          </div>

          <Stack gap={20}>
            <div className={styles.dateGroup}>
              <p className={styles.groupLabel}>Start date</p>
              <div className={styles.dateRow}>
                <Select
                  data={monthOptions}
                  placeholder="Month"
                  value={project.startDate.month || null}
                  onChange={(value) => updateDate("startDate", "month", value ?? "")}
                />
                <Select
                  data={yearOptions}
                  placeholder="Year"
                  value={project.startDate.year || null}
                  onChange={(value) => updateDate("startDate", "year", value ?? "")}
                />
              </div>
            </div>

            <div className={styles.dateGroup}>
              <p className={styles.groupLabel}>End date</p>
              <div className={styles.dateRow}>
                <Select
                  data={monthOptions}
                  placeholder="Month"
                  disabled={project.isCurrent}
                  value={project.endDate.month || null}
                  onChange={(value) => updateDate("endDate", "month", value ?? "")}
                />
                <Select
                  data={yearOptions}
                  placeholder="Year"
                  disabled={project.isCurrent}
                  value={project.endDate.year || null}
                  onChange={(value) => updateDate("endDate", "year", value ?? "")}
                />
              </div>
            </div>
          </Stack>

          <div className={styles.textareaGroup}>
            <Textarea
              id="project-description"
              label="Description"
              placeholder="Describe your role, responsibilities, and key achievements..."
              value={project.description}
              maxLength={2000}
              autosize
              minRows={5}
              maxRows={12}
              onChange={(event) => updateProject("description", event.target.value)}
            />
            <p className={styles.charCount}>
              {descriptionCharactersLeft} characters left
            </p>
          </div>
        </div>

        <div className={styles.footer}>
          {initialData && onDelete ? (
            <Button
              label="Delete Project"
              variant="secondary"
              onClick={handleDelete}
              pill
            />
          ) : (
            <span className={styles.footerSpacer} />
          )}

          <div className={styles.actions}>
            <Button label="Cancel" variant="secondary" pill onClick={handleClose} />
            <Button label="Save" variant="primary" pill onClick={handleSave} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
