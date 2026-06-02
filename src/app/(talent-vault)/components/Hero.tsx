"use client";

import { Sparkle } from "./icons/Sparkle"

export function Hero({ illustration, children }: { illustration: string, children: React.ReactNode }) {
  return (
    <section className="tv-hero">
      {children}
      <div className="tv-hero--illustration-wrapper">
        <div className="tv-sparkle tv-sparkle-1">
          <Sparkle />
        </div>
        <div className="tv-sparkle tv-sparkle-2">
          <Sparkle />
        </div>

        <img
          className="tv-hero--illustration"
          src={illustration}
          alt="Two people having a discussion"
          decoding="async"
        />

        <div className="tv-sparkle tv-sparkle-3">
          <Sparkle />
        </div>
        <div className="tv-sparkle tv-sparkle-4">
          <Sparkle />
        </div>
      </div>
    </section>
  )
}

Hero.Content = function HeroContent({ children }: { children: React.ReactNode }) {
  return <div className="tv-hero--headline">{children}</div>
}
Hero.Headline = function HeroHeadline({ children }: { children: React.ReactNode }) {
  return <h1 className="headline">{children}</h1>
}
Hero.Subheadline = function HeroSubheadline({ children }: { children: React.ReactNode }) {
  return <p className="subheadline">{children}</p>
}
Hero.CTA = function HeroCTA({ children }: { children: React.ReactNode }) {
  return <div className="tv-cta">{children}</div>
}