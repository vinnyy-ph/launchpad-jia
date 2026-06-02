export const toolbarDefaultItems = [
  "insertToken",
  "fontSize",
  "foreColor",
  "hiliteColor",
  "bold",
  "italic",
  "underline",
  "strikeThrough",
  "justifyLeft",
  "justifyCenter",
  "justifyRight",
  "insertOrderedList",
  "insertUnorderedList",
  "insertImage",
  "createLink",
] as const;

export const toolbarDefaultGroups = [
  ["insertToken"],
  ["fontSize"],
  ["foreColor", "hiliteColor", "bold", "italic", "underline", "strikeThrough"],
  ["justifyLeft", "justifyCenter", "justifyRight"],
  ["insertOrderedList", "insertUnorderedList"],
  ["insertImage", "createLink"],
] as (typeof toolbarDefaultItems)[number][][];

export const tokens = [
  // TODO(Vince)
  {
    type: "Careers",
    item: ["Job Title", "Job Description"],
  },
  {
    type: "Organization",
    item: [
      "Organization Name",
      "Organization Description",
      "Organization Location",
    ],
  },
  {
    type: "Candidate",
    item: [
      "Candidate First Name",
      "Candidate Last Name",
      "Candidate Full Name",
      "Candidate Email Address",
      "Candidate CV Screening Reasoning",
    ],
  },
  {
    type: "Others",
    item: ["AI Interview Date"],
  },
];
