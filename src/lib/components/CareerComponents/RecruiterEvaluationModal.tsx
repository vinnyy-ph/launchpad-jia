import { useEffect, useState } from "react";
import CustomDropdown from "./CustomDropdown";
import RichTextEditor from "./RichTextEditor";

const matchFitOptions = [
  {
    name: "Strong Fit",
  },
  {
    name: "Good Fit",
  },
  {
    name: "Maybe Fit",
  },
  {
    name: "Not Fit",
  },
  {
    name: "N/A",
  },
];

export default function RecruiterEvaluationModal({
  evaluation,
  action,
  onAction,
}: {
  evaluation: any;
  action: string;
  onAction: (action: string, data?: any) => void;
}) {
  const [matchFitError, setMatchFitError] = useState<string>("");
  const [recruiterEvaluationForm, setRecruiterEvaluationForm] = useState<any>({
    matchFit: "",
    evaluationNotes: "",
  });

  useEffect(() => {
    if (evaluation) {
      setRecruiterEvaluationForm({
        matchFit: evaluation.matchFit,
        evaluationNotes: evaluation.evaluationNotes,
      });

    }
  }, [evaluation]);

  const actions = {
    add: {
      icon: "la-pencil-alt",
      color: "#181D27",
      iconColor: "#039855",
      iconBgColor: "#D1FADF",
      title: "Add Evaluation",
      buttonText: "Save",
    },
    edit: {
      icon: "la-pencil-alt",
      color: "#181D27",
      iconColor: "#DC6803",
      iconBgColor: "#FEF0C7",
      title: "Edit Evaluation",
      buttonText: "Save Changes",
    },
    delete: {
      icon: "la-trash",
      color: "#B42318",
      iconColor: "#B42318",
      iconBgColor: "#FEE4E2",
      title: "Delete Evaluation",
      description:
        "Are you sure you want to delete this evaluation? <br /> This action cannot be undone.",
      buttonText: "Delete",
    },
  };

  return (
    <div className="modal-background fade-in-bottom">
      <div className="modal-container">
        <div
          className="modal-content"
          style={{
            overflowY: "auto",
            maxHeight: action === "delete" ? "264px" : "624px",
            maxWidth: action === "delete" ? "400px" : "727px",
            background: "#fff",
            border: `1.5px solid #E9EAEB`,
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(30,32,60,0.18)",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            alignItems: action === "delete" ? "center" : "flex-start",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              width: "100%",
            }}
          >
            <div
              style={{
                border: "1px solid #E9EAEB",
                borderRadius: "50%",
                width: "48px",
                height: "48px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: actions[action]?.iconBgColor,
              }}
            >
              <i
                className={`la ${actions[action]?.icon}`}
                style={{ fontSize: 24, color: actions[action]?.iconColor }}
              ></i>
            </div>
            <h3 style={{ fontSize: 18, color: "#181D27", fontWeight: 700 }}>
              {actions[action].title}
            </h3>
          </div>
          {actions[action]?.description && (
            <span
              style={{
                fontSize: 14,
                color: "#717680",
                fontWeight: 500,
                textAlign: "center",
              }}
              dangerouslySetInnerHTML={{ __html: actions[action]?.description }}
            ></span>
          )}
          {action !== "delete" && (
            <>
              <span style={{ fontSize: 14, color: "#414651", fontWeight: 500 }}>
                Match Fit
              </span>
              <CustomDropdown
                screeningSetting={recruiterEvaluationForm.matchFit}
                settingList={matchFitOptions}
                placeholder="Select Match Fit"
                onSelectSetting={(value) =>
                  setRecruiterEvaluationForm({
                    ...recruiterEvaluationForm,
                    matchFit: value,
                  })
                }
                error={matchFitError}
              />
              <span style={{ fontSize: 14, color: "#414651", fontWeight: 500 }}>
                Evaluation Notes
              </span>
              <RichTextEditor
                setText={(value) =>
                  setRecruiterEvaluationForm({
                    ...recruiterEvaluationForm,
                    evaluationNotes: value,
                  })
                }
                text={recruiterEvaluationForm.evaluationNotes}
                error={false}
              />
            </>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: action === "delete" ? "center" : "flex-end",
              gap: 16,
              width: "100%",
            }}
          >
            <button
              onClick={(e) => {
                onAction("");
              }}
              style={{
                display: "flex",
                width: "100%",
                maxWidth: "194px",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                gap: 8,
                backgroundColor: "#FFFFFF",
                borderRadius: "60px",
                border: "1px solid #D5D7DA",
                cursor: "pointer",
                padding: "10px 0px",
              }}
            >
              Cancel
            </button>
            <button
              onClick={(e) => {
                if (!recruiterEvaluationForm.matchFit) {
                  setMatchFitError(
                    "Please select a match fit criteria for this candidate."
                  );
                  return;
                }
                onAction(action, recruiterEvaluationForm);
              }}
              style={{
                display: "flex",
                width: "100%",
                maxWidth: "194px",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                gap: 8,
                backgroundColor: actions[action]?.color,
                color: "#FFFFFF",
                borderRadius: "60px",
                border: "1px solid #D5D7DA",
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {actions[action]?.buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
