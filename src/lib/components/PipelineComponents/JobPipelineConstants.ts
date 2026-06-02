export const matchFitCriteriaList = [
  {
    name: "Only Strong Fit",
    icon: "la la-check-double",
  },
  {
    name: "Good Fit and above",
    icon: "la la-check",
  },
  {
    name: "Maybe Fit and above",
    icon: "la la-check",
  },
  {
    name: "None",
    icon: "la la-times",
  },
];

export const autoDropCriteriaList = [
  {
    name: "Maybe Fit and below",
    icon: "la la-times",
  },
  {
    name: "Bad Fit and below",
    icon: "la la-times",
  },
  {
    name: "None",
    icon: "la la-times",
  },
];

export const modalTypeMap: Record<string, any> = {
  new: {
    title: "Add custom stage",
    icon: "la la-plus",
    color: "#039855",
    iconBgColor: "#D1FADF",
    buttonColor: "black",
    confirmButtonText: "Continue",
    buttonVariant: "primary",
  },
  "rename-stage": {
    title: "Rename Pipeline Stage",
    icon: "la la-pencil",
    color: "#DC6803",
    iconBgColor: "#FEF0C7",
    buttonColor: "black",
    confirmButtonText: "Save",
    buttonVariant: "primary",
  },
  "delete-stage": {
    title: "Delete Pipeline Stage",
    icon: "la la-trash",
    color: "#D92D20",
    iconBgColor: "#FEE4E2",
    buttonColor: "#D92D20",
    confirmButtonText: "Delete",
    description:
      "Are you sure you want to delete this pipeline stage? This action cannot be undone.",
    buttonVariant: "tertiary",
  },
  copy: {
    title: "Copy Pipeline from Another Job",
    icon: "la la-copy",
    color: "#414651",
    iconBgColor: "#FFFFFF",
    confirmButtonText: "Copy Pipeline",
    buttonColor: "black",
    buttonVariant: "primary",
  },
  "auto-endorse": {
    title: "Auto Endorse",
    icon: "la la-user-check",
    color: "#039855",
    iconBgColor: "#D1FADF",
    confirmButtonText: "Save",
    buttonColor: "black",
    buttonVariant: "primary",
  },
  "auto-drop": {
    title: "Auto Drop",
    icon: "la la-user-times",
    color: "#D92D20",
    iconBgColor: "#FEE4E2",
    confirmButtonText: "Save",
    buttonColor: "black",
    buttonVariant: "tertiary",
  },
  "new-substage": {
    title: "Add custom substage",
    icon: "la la-plus",
    color: "#039855",
    iconBgColor: "#D1FADF",
    confirmButtonText: "Continue",
    buttonColor: "black",
    buttonVariant: "primary",
  },
  "rename-substage": {
    title: "Rename Substage",
    icon: "la la-pencil",
    color: "#DC6803",
    iconBgColor: "#FEF0C7",
    confirmButtonText: "Save",
    buttonColor: "black",
    buttonVariant: "primary",
  },
  "delete-substage": {
    title: "Delete Substage",
    icon: "la la-trash",
    color: "#D92D20",
    iconBgColor: "#FEE4E2",
    confirmButtonText: "Delete",
    buttonColor: "#D92D20",
    description:
      "Are you sure you want to delete this substage? This action cannot be undone.",
    buttonVariant: "tertiary",
  },
  "restore-default": {
    title: "Restore to Default",
    icon: "la la-undo-alt",
    color: "#DC6803",
    iconBgColor: "#FEF0C7",
    description:
      "Are you sure you want to restore this pipeline to the default pipeline? This action cannot be undone.",
    confirmButtonText: "Restore",
    buttonColor: "black",
    buttonVariant: "primary",
  },
  "disable-cv-screening": {
    title: "Disable CV Screening?",
    icon: "la la-eye-slash",
    color: "#DC6803",
    iconBgColor: "#FEF0C7",
    description:
      "Disabling CV Screening will prevent this career from being published. You can still save it as Unpublished.",
    confirmButtonText: "Disable",
    buttonColor: "#DC6803",
    buttonVariant: "tertiary",
  },
};
