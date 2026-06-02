"use client";

type PitchDeckProps = {
  children: React.ReactNode;
  number: string;
  bgColor: string;
  theme: "light" | "dark";
}

export function PitchDeck({ number, bgColor, theme, children }: PitchDeckProps) {
  return (
    <div className="pitch-deck" style={{ backgroundColor: bgColor, color: theme === "dark" ? "white" : "black" }}>
      {children}
      <div className="pitch-deck-number">{number}</div>
    </div>
  )
}
PitchDeck.Content = function PitchDeckContent({ pill, children }: { pill: string, children: React.ReactNode }) {
  return (
    <div className="pitch-deck-content--wrapper">
      <div className="tv-section--pill white">{pill}</div>
      <div className="pitch-deck-content">
        {children}
      </div>
    </div>
  );
}
PitchDeck.Title = function PitchDeckTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="tv-section--heading">{children}</h2>
}
PitchDeck.Description = function PitchDeckDescription({ children }: { children: React.ReactNode }) {
  return <p className="tv-section--desc md w-md">{children}</p>
}
PitchDeck.Illustrations = function PitchDeckIllustrations({ children }: { children: React.ReactNode }) {
  return <div className="pitch-deck-illustrations">{children}</div>
}