"use client";

import { tvAssets } from "@/lib/utils/constantsV2";
import { Hero } from "../../components/Hero";
import { PointCard } from "../../components/PointCard";
import { ValuePropositionSection } from "../../components/ValuePropositionSection";
import { PitchDeck } from "../../components/PitchDeck";
import { InvitationSection } from "../../components/InvitationSection";
import Button from "../../components/base/Button";
import { useTalentVaultAuth } from "../../context/TalentVaultAuthContext";

export default function EmployerLandingPage() {
  const { setModalType } = useTalentVaultAuth();
  return (
    <main>
      <Hero illustration={tvAssets.gpDiscussion3}>
        <Hero.Content>
          <Hero.Headline>The <em>better</em> way to hire</Hero.Headline>
          <Hero.Subheadline>Hire faster with pre-interviewed, <strong>job-ready candidates</strong>.</Hero.Subheadline>
        </Hero.Content>
        <Hero.CTA>
          <Button variant="secondary" size="large" href="#how-it-works">
            Learn More
          </Button>
          <Button variant="primary" size="large" href="#partner">
            Partner with us
          </Button>
        </Hero.CTA>
      </Hero>

      <section id="how-it-works" className="tv-challenge">
        <div className="tv-section--flex">
          <div>
            <div className="tv-section--pill fade-up">The Challenge</div>
            <div className="text-white tv-section--content fade-up">
              <h2 className="tv-section--heading">
                Feelling <em className="text-lime no-italic">overwhelmed</em> with job hiring?
              </h2>
              <p className="tv-section--desc md w-md">
                We've been there too. We know what's it's like spending <strong>countless hours</strong> reviewing{" "}
                identical resumes&mdash;only to discover too late that they weren't the best culture fit for the company.
              </p>
            </div>
          </div>
          <img className="gp-person-sleeping fade-up" src={tvAssets.gpSleepingDesk} alt="Person sleeping on his desk" loading="lazy" decoding="async" />
        </div>

        <div className="tv-section">
          <div className="text-white tv-section--content fade-up">
            <h2 className="tv-section--heading">
              Ever felt like hiring feels like a never-ending search? Same.
            </h2>
            <p className="tv-section--desc lg">Here's how the hiring process usually goes</p>
          </div>

          <div className="tv-section--card-list fade-up">
            <PointCard
              bgColor="#E5EAFE"
              photoSrc={tvAssets.gpLaptop}
              title="Post job openings"
              description="Post your carefully, curated job openings"
            />

            <PointCard
              bgColor="#FFFEF8"
              photoSrc={tvAssets.gpOverload}
              title="Receive 999 applications"
              description="Congratulations! Now you have to filter through each one of them."
            />

            <PointCard
              bgColor="#E5EAFE"
              photoSrc={tvAssets.gpGhost}
              title="Get ghosted by applicants"
              description="Are they for real? Sometimes they don't even reply!"
            />

            <PointCard
              bgColor="#FFFEF8"
              photoSrc={tvAssets.gpRinseRepeat}
              title="Rinse and repeat"
              description="This goes on until you finally find the &#34;perfect&#34; candidate... But will they actually stay?"
            />
          </div>

          <div className="tv-section--desc sm text-white w-md fade-up">
            **<strong>Did you know?</strong> On average, hiring process can take up to{" "}
            30-90+ days per job position. Now imagine if your company have lots of job openings. Good luck champ!
          </div>

          <div className="text-white tv-section--content fade-up" style={{ marginTop: "80px" }}>
            <p className="tv-section--desc lg" style={{ marginBottom: "4px" }}>But what if there was a</p>
            <p className="tv-section--heading">a <em className="text-lime no-italic">better</em> way of hiring applicants?</p>
          </div>
        </div>
      </section>

      <section id="results" className="tv-section standalone overlap" style={{
        backgroundColor: "#CDF4BF",
        borderRadius: "80px",
      }}>
        <div>
          <div className="tv-section--pill fade-up">Real Results</div>
          <div className="tv-section--content fade-up">
            <h2 className="tv-section--heading">Real, fast, reliable results</h2>
            <p className="tv-section--desc md">
              Here's what we found out from our initial launch
            </p>
          </div>

          <div className="tv-section--card-list fade-up" style={{ marginTop: "40px" }}>
            <PointCard
              bgColor="#FFFEF8"
              photoSrc={tvAssets.gpPersonTyping}
              title="70% less time screening"
              description="Speed up your hiring process"
            />

            <PointCard
              bgColor="#6372FF"
              theme="dark"
              photoSrc={tvAssets.gpTimeManagement}
              title="3x faster shortlist turnaround"
              description="Because we know time is money"
            />

            <PointCard
              bgColor="#FFFEF8"
              photoSrc={tvAssets.gpPuzzle}
              title="Stronger culture-fit from day one"
              description="Because soft skils matter as much as technical skills"
            />
          </div>
        </div>
      </section>

      <ValuePropositionSection />

      <section id="why-join">
        <div className="pitch-deck-stack-container">
          <PitchDeck number="01" bgColor="var(--indigo)" theme="dark">
            <PitchDeck.Content pill="The Jia Talent Vault Advantage">
            <PitchDeck.Title><em className="text-lime no-italic">Instant</em> insight</PitchDeck.Title>
            <hr />
            <PitchDeck.Description>
              View candidate’s AI interview responses before deciding to schedule an interview with them.
            </PitchDeck.Description>
          </PitchDeck.Content>
          <PitchDeck.Illustrations>
            <img src={tvAssets.gpFinance} alt="Woman reporting financial results" loading="lazy" decoding="async" />
          </PitchDeck.Illustrations>
          </PitchDeck>

          <PitchDeck number="02" bgColor="#5CCCB8" theme="light">
            <PitchDeck.Content pill="The Jia Talent Vault Advantage">
            <PitchDeck.Title><em className="text-white no-italic">Save</em> time</PitchDeck.Title>
            <hr style={{ borderColor: "black" }} />
            <PitchDeck.Description>
              Skip two early stages of your recruitment funnel and get straight to applicants that{" "}
              match your expectations.
            </PitchDeck.Description>
          </PitchDeck.Content>
          <PitchDeck.Illustrations>
            <img src={tvAssets.gpWomanWorking2} alt="Woman working and drinking her tea" loading="lazy" decoding="async" />
          </PitchDeck.Illustrations>
          </PitchDeck>

          <PitchDeck number="03" bgColor="#C1F2B0" theme="light">
            <PitchDeck.Content pill="The Jia Talent Vault Advantage">
            <PitchDeck.Title><em className="text-indigo no-italic">Better</em> matches</PitchDeck.Title>
            <hr style={{ borderColor: "black" }} />
            <PitchDeck.Description>
              Filter not just with with both hard and soft skills. Check for confidence, clarity, enthusiasm, or other behavioral signals.
            </PitchDeck.Description>
          </PitchDeck.Content>
          <PitchDeck.Illustrations>
            <img src={tvAssets.gpShakeHands} alt="Two people shaking hands" loading="lazy" decoding="async" />
          </PitchDeck.Illustrations>
          </PitchDeck>

          <PitchDeck number="04" bgColor="#CF98FF" theme="light">
            <PitchDeck.Content pill="The Jia Talent Vault Advantage">
            <PitchDeck.Title><em className="text-lime no-italic">Verified</em> talent</PitchDeck.Title>
            <hr style={{ borderColor: "black" }} />
            <PitchDeck.Description>
              No fake applicants, only real talents. All candidates come from university partners across the country.
            </PitchDeck.Description>
          </PitchDeck.Content>
          <PitchDeck.Illustrations>
            <div className="gp-people-group">
              <img className="gp-green-check-1" src={tvAssets.gpBubbleGreenCheck} alt="Green check bubble" loading="lazy" decoding="async" />
              <img className="gp-green-check-2" src={tvAssets.gpBubbleGreenCheck} alt="Green check bubble" loading="lazy" decoding="async" />
              <img className="gp-green-check-3" src={tvAssets.gpBubbleGreenCheck} alt="Green check bubble" loading="lazy" decoding="async" />
              <img className="gp-people-walking" src={tvAssets.gpPeopleWalking} alt="Two person walking" loading="lazy" decoding="async" />
            </div>
          </PitchDeck.Illustrations>
          </PitchDeck>
        </div>
      </section>

      <InvitationSection
        id="partner"
        title="Partner with Jia Talent Vault"
        message="Get early access to pre-interviewed graduates from top schools."
      >
        <InvitationSection.CTA>
          <Button variant="primary" size="large" onClick={() => setModalType("signIn")}>
            Sign up now
          </Button>
        </InvitationSection.CTA>
      </InvitationSection>
    </main>
  )
}
