"use client";

import { tvAssets } from "@/lib/utils/constantsV2";
import { Sparkle } from "./icons/Sparkle";

type InvitationSectionProps = {
  id?: string;
  title: string;
  message: string;
  children: React.ReactNode;
}

export function InvitationSection({ id, title, message, children }: InvitationSectionProps) {
  return (
    <section id={id} className="tv-section standalone padding-md-center tv-invitation-section" style={{ backgroundColor: "#C1F2B0" }}>
      <div className="tv-section--content fade-up">
        <h2 className="tv-section--heading">{title}</h2>
        <p className="tv-section--desc md">{message}</p>
      </div>
      {children}

      <div className="tv-invitation-section--illustration fade-up">
        <img className="gp-safe" src={tvAssets.gpSafe} alt="Safe" loading="lazy" decoding="async" />
      </div>

      <div className="tv-invitation-sparkle tv-invitation-sparkle-1">
        <Sparkle />
      </div>
      <div className="tv-invitation-sparkle tv-invitation-sparkle-2">
        <Sparkle />
      </div>
      <div className="tv-invitation-sparkle tv-invitation-sparkle-3">
        <Sparkle />
      </div>
      <div className="tv-invitation-sparkle tv-invitation-sparkle-4">
        <Sparkle />
      </div>
      <div className="tv-invitation-sparkle tv-invitation-sparkle-5">
        <Sparkle />
      </div>
    </section>
  )
}

InvitationSection.CTA = function InvitationSectionCTA({children}: {children: React.ReactNode}) {
  return <div className="tv-cta fade-up">{children}</div>
}