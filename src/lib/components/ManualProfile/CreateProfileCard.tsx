// The "Create a Profile Manually" entry card shown beside the CV-upload card.
// Shared by both wizard mounts (job-portal UploadCV + talent-vault SubmitCVStep);
// each passes its own module's card class so the host page's styling applies.
export default function CreateProfileCard({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div className={className}>
      <img alt="" src="/iconsV3/create-profile.svg" />
      <button type="button" onClick={onClick}>
        Create a Profile Manually
      </button>
      <span>
        Quickstart your job application by creating your own CV from scratch.
      </span>
    </div>
  );
}
