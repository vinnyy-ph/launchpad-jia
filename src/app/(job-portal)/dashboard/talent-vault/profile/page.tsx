"use client";

import { TalentVaultProfileDashboard } from "@/app/(talent-vault)/components/applicant-profile/TalentVaultProfileDashboard";
import { isTalentVaultEnabled } from "@/app/(talent-vault)/lib/helpers";
import { useAppContext } from "@/lib/context/ContextV2";
import { pathConstants } from "@/lib/utils/constantsV2";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function () {
  const { user } = useAppContext();
  const router = useRouter();

  useEffect(() => {
    if (user?.email && !isTalentVaultEnabled(user.email)) {
      router.replace(pathConstants.dashboard);
    }
  }, [user?.email, router]);

  return <TalentVaultProfileDashboard />;
}
