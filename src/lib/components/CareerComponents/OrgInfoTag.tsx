import { useEffect, useState } from "react";
import { api } from "@/lib/utils/apiClient";

export default function OrgInfoTag(props: any) {
  const { orgID, labelText } = props;

  const [orgDetails, setOrgDetails] = useState(null);

  useEffect(() => {
    const fetchOrgDetails = async () => {
      const response = await api.post("/api/feth-org-details", {
        orgID,
      });
      const data = await response.data;
      setOrgDetails(data);
    };
    fetchOrgDetails();
  }, [orgID]);

  return (
    <div className="org-info-tag">
      <small>{labelText}</small>
      <div className="org-info">
        <img src={orgDetails?.image} className="avatar avatar-md" alt="org" />
        <span>{orgDetails?.name}</span>
      </div>
    </div>
  );
}
