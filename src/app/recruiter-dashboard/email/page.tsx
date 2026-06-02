"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import { useSearchParams } from "next/navigation";
import { useAppContext } from "@/lib/context/AppContext";
import { errorToast } from "@/lib/Utils";
import AllEmailsModule from "@/lib/components/EmailComponents/AllEmailsModule";
import SuperAdminFeature from "@/lib/components/SuperAdminFeature";

export default function () {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  const { orgID } = useAppContext();
  const [candidatename, setCandidatename] = useState<string>("");
  const handleSetCandidatename = useCallback((name: string) => {
    setCandidatename(name);
  }, []);

  useEffect(() => {
    if (orgID) {
      // do things
    }
  }, [orgID]);

  return (
    <>
      <HeaderBar activeLink="Candidates" currentPage="Emails" icon="la la-id-badge" />

      <div className="container-fluid mt--7" style={{ paddingTop: "6rem" }}>
        <div className="row">
          <div className="col">

            <AllEmailsModule setCandidatename={handleSetCandidatename} />
            <SuperAdminFeature>
            </SuperAdminFeature>
          </div>
        </div>
      </div>
    </>
  );
}

