"use client";

import { useEffect, useState } from "react";
import { tvAssets } from "@/lib/utils/constantsV2";

const skills = [
  "Communication",
  "Honesty",
  "Leadership",
  "Teamwork",
  "Confidence",
  "Attention to detail",
  "Collaboration",
  "Time Management"
];

export function ValuePropositionSection() {
  const [highlighted, setHighlighted] = useState<number[]>([2, 4]);

  useEffect(() => {
    const interval = setInterval(() => {
      let newIndices: number[];
      do {
        const indices = new Set<number>();
        while (indices.size < 2) {
          indices.add(Math.floor(Math.random() * skills.length));
        }
        newIndices = Array.from(indices);
      } while (
        newIndices.length === highlighted.length &&
        newIndices.every(idx => highlighted.includes(idx))
      );
      
      setHighlighted(newIndices);
    }, 3000);

    return () => clearInterval(interval);
  }, [highlighted]);

  return (
    <section id="why-it-works" className="tv-section standalone">
      <div>
        <div className="tv-section--pill fade-up">Why it works</div>
        <div className="tv-section--content fade-up">
          <h2 className="tv-section--heading">Smart matching, not endless searching</h2>
          <p className="tv-section--desc md">
            Because we believe there's more to your technical skills to make that culture fit for the company.{" "}
            Here are the other things Jia watches out for pre-interviewed candidates
          </p>
        </div>

        <ul className="pt-pill-list fade-up" style={{ marginTop: "20px" }}>
          {skills.map((skill, index) => (
            <li key={skill} className={highlighted.includes(index) ? "highlighted" : ""}>
              {skill}
            </li>
          ))}
        </ul>
      </div>

      <img
        className="value-prop-woman-working fade-up"
        src={tvAssets.gpWomanWorking}
        alt="Woman working remotely on her laptop"
        loading="lazy"
        decoding="async"
      />
    </section>
  )
}