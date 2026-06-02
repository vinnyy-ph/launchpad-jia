import sanitizeHtml from 'sanitize-html';

/**
 * Sanitize configuration options
 */
const STRICT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [], // No HTML tags allowed - strips all HTML
  allowedAttributes: {},
  disallowedTagsMode: 'recursiveEscape', // Escape rather than remove
};

const MODERATE_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'b', 'i', 'em', 'strong', 'u', 's', 'strike',
    'p', 'br', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'pre', 'code',
    'a', 'span', 'div',
  ],
  allowedAttributes: {
    'a': ['href', 'title', 'target'],
    '*': ['style'], // Allow style attribute for basic formatting
  },
  allowedStyles: {
    '*': {
      'color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/],
      'text-align': [/^left$/, /^right$/, /^center$/],
      'font-size': [/^\d+(?:px|em|%)$/],
      'font-weight': [/^bold$/],
      'font-style': [/^italic$/],
      'text-decoration': [/^underline$/, /^line-through$/],
    }
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  disallowedTagsMode: 'recursiveEscape',
};

/**
 * Sanitize a string by removing/escaping dangerous HTML and JavaScript
 * @param input - The string to sanitize
 * @param mode - 'strict' (no HTML) or 'moderate' (allow safe HTML formatting)
 * @returns Sanitized string
 */
export function sanitizeString(input: string, mode: 'strict' | 'moderate' = 'strict'): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const options = mode === 'strict' ? STRICT_SANITIZE_OPTIONS : MODERATE_SANITIZE_OPTIONS;
  return sanitizeHtml(input.trim(), options);
}

/**
 * Sanitize an object recursively
 * @param obj - The object to sanitize
 * @param mode - 'strict' or 'moderate'
 * @returns Sanitized object
 */
export function sanitizeObject<T>(obj: T, mode: 'strict' | 'moderate' = 'strict'): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj, mode) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, mode)) as T;
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value, mode);
    }
    return sanitized;
  }

  // For numbers, booleans, etc., return as-is
  return obj;
}

/**
 * Validate and sanitize interview questions
 * Questions should be an array of objects with specific properties
 */
export function sanitizeQuestions(questions: any): any[] {
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions.map(q => {
    if (typeof q === 'string') {
      return sanitizeString(q, 'strict');
    }
    if (typeof q === 'object' && q !== null) {
      return sanitizeObject(q, 'strict');
    }
    return q;
  });
}

/**
 * Validate that a string doesn't contain JavaScript code patterns
 * This is an additional check beyond HTML sanitization
 */
export function containsSuspiciousPatterns(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers like onclick=, onload=, etc.
    /eval\s*\(/i,
    /expression\s*\(/i, // CSS expressions
    /<iframe/i,
    /<embed/i,
    /<object/i,
    /vbscript:/i,
    /data:text\/html/i,
  ];

  return suspiciousPatterns.some(pattern => pattern.test(input));
}

/**
 * Check an entire object for suspicious patterns
 */
export function objectContainsSuspiciousPatterns(obj: any): boolean {
  if (typeof obj === 'string') {
    return containsSuspiciousPatterns(obj);
  }

  if (Array.isArray(obj)) {
    return obj.some(item => objectContainsSuspiciousPatterns(item));
  }

  if (typeof obj === 'object' && obj !== null) {
    return Object.values(obj).some(value => objectContainsSuspiciousPatterns(value));
  }

  return false;
}

/**
 * Decode HTML entities to their actual characters
 * @param str - String containing HTML entities
 * @returns Decoded string
 */
export function decodeHtmlEntities(str: string): string {
  if (!str || typeof str !== 'string') {
    return str || '';
  }
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#91;/g, "[")
    .replace(/&#93;/g, "]")
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/&copy;/g, "©")
    .replace(/&reg;/g, "®")
    .replace(/&trade;/g, "™")
    .replace(/&euro;/g, "€")
    .replace(/&pound;/g, "£")
    .replace(/&yen;/g, "¥")
    .replace(/&cent;/g, "¢");
}
