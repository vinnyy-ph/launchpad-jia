export interface AddressParts {
  street: string;
  city: string;
  province: string;
  postal: string;
  country: string;
}

export function createEmptyAddressParts(): AddressParts {
  return { street: "", city: "", province: "", postal: "", country: "" };
}

// Joins the structured address parts into a single display string: trims each
// part, drops empties, joins with ", ". Order: street, city, province, postal,
// country. This composed string is the single source of truth stored in
// contactInfo.address.
export function composeAddress(parts: AddressParts): string {
  return [parts.street, parts.city, parts.province, parts.postal, parts.country]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}
