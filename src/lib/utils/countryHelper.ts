export const countryCodeMap: Record<string, string> = {
  PH: "Philippines",
  AU: "Australia",
  SG: "Singapore",
  GB: "United Kingdom",
  US: "United States of America",
};

export const isUserInJobCountry = (
  userCountryCode: string | null,
  jobCountry: string | undefined,
  jobLocationCountryCode?: string | undefined
): boolean => {
  if (!userCountryCode) return true;
  const userCountryName = countryCodeMap[userCountryCode];
  if (!userCountryName) return true;

  if (jobLocationCountryCode) {
    const normalised = jobLocationCountryCode.trim().toUpperCase();
    if (normalised === userCountryCode.toUpperCase()) return true;
    const keyForCode = Object.keys(countryCodeMap).find(
      (k) => k.toUpperCase() === normalised || countryCodeMap[k].toUpperCase() === normalised
    );
    if (keyForCode) return keyForCode.toUpperCase() === userCountryCode.toUpperCase();
  }

  if (jobCountry) {
    const jobCountryLower = jobCountry.toLowerCase();
    const userCodeLower = userCountryCode.toLowerCase();
    const userNameLower = userCountryName.toLowerCase();
    return jobCountryLower === userCodeLower || jobCountryLower === userNameLower;
  }

  return false;
};
