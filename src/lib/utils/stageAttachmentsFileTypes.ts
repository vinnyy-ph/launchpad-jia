export const ALLOWED_MIME_TO_EXTS: Record<string, string[]> = {
  "application/pdf": ["pdf"],

  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],

  "audio/mpeg": ["mp3"],
  "audio/mp4": ["m4a"],
  "audio/wav": ["wav"],
  "audio/aac": ["aac"],
  "audio/ogg": ["ogg"],

  "video/mp4": ["mp4"],
  "video/webm": ["webm"],
  "video/quicktime": ["mov"],
  "video/x-matroska": ["mkv"],

  "application/vnd.ms-excel": ["xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
};

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return "";
  }
  return filename.slice(lastDot + 1).toLowerCase();
}

export interface FileValidationResult {
  allowed: boolean;
  reason: string;
}

export function isAllowedStageAttachment(params: {
  filename: string;
  mimeType: string;
}): FileValidationResult {
  const { filename, mimeType } = params;
  const ext = getExtension(filename);

  const allowedExtensions = ALLOWED_MIME_TO_EXTS[mimeType];

  if (!allowedExtensions) {
    return {
      allowed: false,
      reason: `File type "${mimeType}" is not allowed`,
    };
  }

  if (!ext) {
    return {
      allowed: false,
      reason: "File must have an extension",
    };
  }

  if (!allowedExtensions.includes(ext)) {
    return {
      allowed: false,
      reason: `Extension ".${ext}" does not match expected extensions for "${mimeType}"`,
    };
  }

  return {
    allowed: true,
    reason: "File type allowed",
  };
}

export function buildAcceptAttr(): string {
  const parts: string[] = [];

  for (const [mimeType, extensions] of Object.entries(ALLOWED_MIME_TO_EXTS)) {
    parts.push(mimeType);
    for (const ext of extensions) {
      parts.push(`.${ext}`);
    }
  }

  return parts.join(",");
}

export function getAllowedTypesDescription(): string {
  const categories: Record<string, string[]> = {
    Documents: [],
    Images: [],
    Audio: [],
    Video: [],
  };

  for (const [mimeType, extensions] of Object.entries(ALLOWED_MIME_TO_EXTS)) {
    const exts = extensions.map((e) => `.${e.toUpperCase()}`).join(", ");

    if (
      mimeType === "application/pdf" ||
      mimeType.includes("word") ||
      mimeType.includes("spreadsheet") ||
      mimeType.includes("excel") ||
      mimeType === "text/plain"
    ) {
      categories.Documents.push(exts);
    } else if (mimeType.startsWith("image/")) {
      categories.Images.push(exts);
    } else if (mimeType.startsWith("audio/")) {
      categories.Audio.push(exts);
    } else if (mimeType.startsWith("video/")) {
      categories.Video.push(exts);
    }
  }

  const parts: string[] = [];
  for (const [category, exts] of Object.entries(categories)) {
    if (exts.length > 0) {
      parts.push(`${category}: ${exts.join(", ")}`);
    }
  }

  return parts.join(" | ");
}

