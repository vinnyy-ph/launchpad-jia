const originPath = "/";
const jobOpeningsOriginPath = "/job-openings";
const dashboardOriginPath = "/dashboard";

// Derive portal URLs from the deployment's domain env vars, falling back to
// the legacy production domains when unset.
const domainToUrl = (domain: string | undefined, fallback: string) =>
  domain
    ? `${domain.includes("localhost") ? "http" : "https"}://${domain}`
    : fallback;

const applicantUrl = domainToUrl(
  process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN,
  "https://www.hellojia.ai"
);
const employerUrl = domainToUrl(
  process.env.NEXT_PUBLIC_EMPLOYER_APP_DOMAIN,
  "https://www.hirejia.ai"
);

export const pathConstants = {
  employee: applicantUrl,
  // Single-domain deploys rewrite "/" to the applicant job portal, so the
  // employer landing page lives at /employers there (see middleware.ts).
  employer:
    applicantUrl === employerUrl ? `${employerUrl}/employers` : employerUrl,
  // Path of the employer landing page on this deployment, for in-app links
  // to its sections (#contact-us, #faqs, ...).
  employerLanding: applicantUrl === employerUrl ? "/employers" : "/",
  whitecloak: "https://www.whitecloak.com",
  home: originPath,
  jobOpenings: jobOpeningsOriginPath,
  dashboard: dashboardOriginPath,
  dashboardJobOpenings: dashboardOriginPath + "/job-openings",
  dashboardSettings: dashboardOriginPath + "/settings",
  manageCV: dashboardOriginPath + "/manage-cv",
  uploadCV: dashboardOriginPath + "/upload-cv",
  talentVault: dashboardOriginPath + "/talent-vault",
  talentVaultSetup: dashboardOriginPath + "/talent-vault/setup",
};

const gifsPath = "/gifsV2/";
const iconsPath = "/iconsV3/";
const imagesPath = "/imagesV2/";
const tvAssetsPath = "/talent-vault/";

export const assetConstants = {
  // gifs
  loading: gifsPath + "loading.gif",

  // icons
  account: iconsPath + "account.svg",
  alert: iconsPath + "alert.svg",
  archive: iconsPath + "archive.svg",
  archiveV2: iconsPath + "archiveV2.svg",
  arrow: iconsPath + "arrow.svg",
  arrowCircle: iconsPath + "arrowCircle.svg",
  arrowV2: iconsPath + "arrowV2.svg",
  arrowV3: iconsPath + "arrowV3.svg",
  bell: iconsPath + "bell.svg",
  bellV2: iconsPath + "bellV2.svg",
  briefcase: iconsPath + "briefcase.svg",
  briefcaseV2: iconsPath + "briefcaseV2.svg",
  check: iconsPath + "check.svg",
  checkV2: iconsPath + "checkV2.svg",
  checkV3: iconsPath + "checkV3.svg",
  checkV4: iconsPath + "checkV5.svg",
  checkV5: iconsPath + "checkV6.svg",
  checkCircle: iconsPath + "check-circle.svg",
  chevron: iconsPath + "chevron.svg",
  chevronV2: iconsPath + "chevronV2.svg",
  clock: iconsPath + "clock.svg",
  completed: iconsPath + "checkV4.svg",
  copy: iconsPath + "copy.svg",
  crosshair: iconsPath + "crosshair.svg",
  crosshairV2: iconsPath + "crosshairV2.svg",
  dashboard: iconsPath + "dashboard.svg",
  edit: iconsPath + "edit.svg",
  ellipsis: iconsPath + "ellipsis.svg",
  externalLink: iconsPath + "external-link.svg",
  file: iconsPath + "file.svg",
  fileV2: iconsPath + "fileV2.svg",
  filter: iconsPath + "filter.svg",
  google: iconsPath + "google.svg",
  hilight: iconsPath + "hilight.svg",
  in_progress: iconsPath + "in-progress.svg",
  jia: iconsPath + "jia.svg",
  jiaLogo: iconsPath + "jia-logo.svg",
  jiaLogo2: iconsPath + "jia-logo2.svg",
  logout: iconsPath + "logout.svg",
  logoutV2: iconsPath + "logoutV2.svg",
  logoutV3: iconsPath + "logoutV3.svg",
  magnifyingGlassTiltedLeft: iconsPath + "magnifying-glass-tilted-left.svg",
  mapPin: iconsPath + "map-pin.svg",
  linkedin: iconsPath + "linkedin.svg",
  partyPopper: iconsPath + "party-popper-130339.png",
  gradientIcon: iconsPath + "gradient-icon.svg",
  gradientStar: iconsPath + "gradient-star.svg",
  helpCircle: iconsPath + "help-circle.svg",
  menu: iconsPath + "menu.svg",
  pending: iconsPath + "pending.svg",
  playCircle: iconsPath + "play-circle.svg",
  plus: iconsPath + "plus.svg",
  result: iconsPath + "result.svg",
  review: iconsPath + "review.svg",
  rotate: iconsPath + "rotate.svg",
  rotateV2: iconsPath + "rotateV2.svg",
  rotateCcw: iconsPath + "rotate-ccw.svg",
  save: iconsPath + "save.svg",
  search: iconsPath + "search.svg",
  settings: iconsPath + "settings.svg",
  share: iconsPath + "share.svg",
  sort: iconsPath + "sort.svg",
  talentVault: iconsPath + "tv-icon.svg",
  trash: iconsPath + "trash.svg",
  trashV2: iconsPath + "trashV2.svg",
  trendingUp: iconsPath + "trending-up.svg",
  upload: iconsPath + "upload.svg",
  uploadV2: iconsPath + "uploadV2.svg",
  userCheck: iconsPath + "user-check.svg",
  userRejected: iconsPath + "user-rejected.svg",
  userRejectedV2: iconsPath + "image-1-595782.png",
  x: iconsPath + "x.svg",
  xV2: iconsPath + "xV2.svg",
  xV3: iconsPath + "xV3.svg",
  verifiedTick: iconsPath + "verified-tick.svg",
  salary: iconsPath + "salary.svg",
  globe: iconsPath + "globe.svg",
  localHiring: iconsPath + "local-hiring.svg",
  tvIcon: tvAssetsPath + "tv-icon.svg",

  // images
  background: imagesPath + "background.webp",
  owl: imagesPath + "owl.webp",
  owlMobile: imagesPath + "owl-mobile.webp",
  sphereLeft: imagesPath + "sphere-left.webp",
  sphereMobile: imagesPath + "sphere-mobile.webp",
  sphereRight: imagesPath + "sphere-right.webp",
};

export const tvAssets = {
  tvLogo: tvAssetsPath + "tv-logo.svg",
  tvIcon: tvAssetsPath + "tv-icon.svg",
  gpBubbleGreenCheck: tvAssetsPath + "gp-bubble-green-check.png",
  gpDiscussion: tvAssetsPath + "gp-discussion.png",
  gpDiscussion2: tvAssetsPath + "gp-discussion-2.png",
  gpDiscussion3: tvAssetsPath + "gp-discussion-3.png",
  gpFinance: tvAssetsPath + "gp-finance.png",
  gpGhost: tvAssetsPath + "gp-ghost.png",
  gpKeyLock: tvAssetsPath + "gp-key-lock.png",
  gpLaptop: tvAssetsPath + "gp-laptop.png",
  gpLaptop2: tvAssetsPath + "gp-laptop-2.png",
  gpLaptop3: tvAssetsPath + "gp-laptop-3.png",
  gpMagnifyingGlass: tvAssetsPath + "gp-magnifying-glass.png",
  gpOverload: tvAssetsPath + "gp-overload.png",
  gpPeopleWalking: tvAssetsPath + "gp-people-walking.png",
  gpPersonTyping: tvAssetsPath + "gp-person-typing.png",
  gpPodcast: tvAssetsPath + "gp-podcast.png",
  gpPuzzle: tvAssetsPath + "gp-puzzle.png",
  gpRinseRepeat: tvAssetsPath + "gp-rinse-repeat.png",
  gpSafe: tvAssetsPath + "gp-safe.png",
  gpShakeHands: tvAssetsPath + "gp-shake-hands.png",
  gpSleepingDesk: tvAssetsPath + "gp-sleeping-desk.png",
  gpTimeManagement: tvAssetsPath + "gp-time-management.png",
  gpWhiteStar: tvAssetsPath + "gp-white-star.png",
  gpWomanDancing: tvAssetsPath + "gp-woman-dancing.png",
  gpWomanWorking: tvAssetsPath + "gp-woman-working.png",
  gpWomanWorking2: tvAssetsPath + "gp-woman-working-2.png",
  gpPersonSitting: tvAssetsPath + "gp-person-sitting.png",
};