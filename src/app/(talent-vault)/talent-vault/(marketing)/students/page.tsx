"use client";

import { tvAssets } from "@/lib/utils/constantsV2";
import { Hero } from "@/app/(talent-vault)/components/Hero";
import { PointCard } from "@/app/(talent-vault)/components/PointCard";
import { ValuePropositionSection } from "@/app/(talent-vault)/components/ValuePropositionSection";
import { PitchDeck } from "@/app/(talent-vault)/components/PitchDeck";
import { InvitationSection } from "@/app/(talent-vault)/components/InvitationSection";
import MarketingButton from "@/app/(talent-vault)/components/base/Button";
import Button from "@/lib/components/ui/button/Button";
import { useTalentVaultAuth } from "@/app/(talent-vault)/context/TalentVaultAuthContext";

export default function StudentsLandingPage() {
  const { setModalType, user } = useTalentVaultAuth();

  return (
    <main>
      <Hero illustration={tvAssets.gpDiscussion}>
        <Hero.Content>
          <Hero.Headline>The <em>better</em> way to job hunt</Hero.Headline>
          <Hero.Subheadline>Job hunting? Jia Talent Vault lets the <strong>jobs find you</strong>.</Hero.Subheadline>
        </Hero.Content>
        <Hero.CTA>
          <MarketingButton variant="secondary" size="large" href="#the-challenge">
            Learn More
          </MarketingButton>
          <Button 
            pill
            variant="primary" 
            size="large"
            label="Join Jia Talent Vault"
            onClick={() => setModalType("signIn")} 
          />
        </Hero.CTA>
      </Hero>

      <section id="the-challenge" className="tv-challenge">
        <div className="tv-section--flex">
          <div>
            <div className="tv-section--pill fade-up">The Challenge</div>
            <div className="text-white tv-section--content fade-up">
              <h2 className="tv-section--heading">We get it, the job market can be <em className="text-lime no-italic">tough</em>.</h2>
              <p className="tv-section--desc md w-md">Getting ghosted by companies? Stuck in an endless loop of job applications? Trust us, we've been there.</p>
            </div>
          </div>
          <img className="fade-up" src={tvAssets.gpSleepingDesk} alt="Person sleeping on his desk" loading="lazy" decoding="async" />
        </div>

        <div className="tv-section">
          <div className="text-white tv-section--content fade-up">
            <h2 className="tv-section--heading">Finding the right job often feels like an endless search</h2>
            <p className="tv-section--desc lg">Here's how job hunting usually goes</p>
          </div>

          <div className="tv-section--card-list fade-up">
            <PointCard
              bgColor="#E5EAFE"
              photoSrc={tvAssets.gpMagnifyingGlass}
              title="Search job openings"
              description="You go through job search sites, hopeful to get that one job"
            />

            <PointCard
              bgColor="#FFFEF8"
              photoSrc={tvAssets.gpLaptop}
              title="Send resume and CV to all"
              description="Hit send with your resume, CV to each and every job application"
            />

            <PointCard
              bgColor="#E5EAFE"
              photoSrc={tvAssets.gpGhost}
              title="Get ghosted by companies"
              description="or your finding out you're not a match for the job :("
            />

            <PointCard
              bgColor="#FFFEF8"
              photoSrc={tvAssets.gpRinseRepeat}
              title="Rinse and repeat"
              description="This goes on until you finally land that job"
            />
          </div>

          <div className="tv-section--desc sm text-white w-md fade-up">
            **<strong>Did you know?</strong> On average, the usual job hunting process can take up to{" "}
            five months* of submitting job applications daily.** That means you'll be sending your resumes{" "}
            up to 450 times! Woah.
          </div>

          <div className="text-white tv-section--content fade-up" style={{ marginTop: "80px" }}>
            <p className="tv-section--desc lg" style={{ marginBottom: "4px" }}>But what if there was a</p>
            <p className="tv-section--heading">a <em className="text-lime no-italic">better</em> way of applying for jobs?</p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="tv-section standalone overlap" style={{
        backgroundColor: "#CDF4BF",
        borderRadius: "80px",
      }}>
        <div>
          <div className="tv-section--pill fade-up">How it works</div>
          <div className="tv-section--content fade-up">
            <h2 className="tv-section--heading">Set up your profile once, and you're good to go.</h2>
            <p className="tv-section--desc md">
              Being part of Jia Talent Vault lets you spend more time refining your goals and resume, less time{" "}
              job hunting and hopping.
            </p>
          </div>

          <div className="tv-section--card-list fade-up" style={{ marginTop: "40px" }}>
            <PointCard
              bgColor="#FFFEF8"
              photoSrc={tvAssets.gpPersonTyping}
              title="Set up your profile"
              description="We'll let you setup your profile, resume, and even career goals."
            />

            <PointCard
              bgColor="#6372FF"
              theme="dark"
              photoSrc={tvAssets.gpLaptop2}
              title="Get interviewed by Jia"
              description="Jia is our smart AI interviewer who can assess your technical and soft skills."
            />

            <PointCard
              bgColor="#FFFEF8"
              photoSrc={tvAssets.gpPersonSitting}
              title="Wait for job opportunities to come in"
              description="Once you're done we'll show your profile to relevant companies that match your skills and goals."
            />
          </div>
        </div>
      </section>

      <ValuePropositionSection />

      <section id="why-join">
        <div className="pitch-deck-stack-container">
          <PitchDeck number="01" bgColor="var(--indigo)" theme="dark">
            <PitchDeck.Content pill="The Jia Talent Vault Advantage">
              <PitchDeck.Title><em className="text-lime no-italic">Stand out</em> instantly</PitchDeck.Title>
              <hr />
              <PitchDeck.Description>Start with our verified AI-powered initial interview so employers see more than just your CV.</PitchDeck.Description>
            </PitchDeck.Content>
            <PitchDeck.Illustrations>
              <img className="gp-white-star" src={tvAssets.gpWhiteStar} alt="White star" loading="lazy" decoding="async" />
              <img className="gp-laptop-3" src={tvAssets.gpLaptop3} alt="Laptop" loading="lazy" decoding="async" />
              <img className="gp-woman-dancing" src={tvAssets.gpWomanDancing} alt="Dancing woman dressed in gradient dress" loading="lazy" decoding="async" />
            </PitchDeck.Illustrations>
          </PitchDeck>

          <PitchDeck number="02" bgColor="#5CCCB8" theme="light">
            <PitchDeck.Content pill="Why Join Jia Talent Vault">
              <PitchDeck.Title><em className="text-white no-italic">Skip</em> the line</PitchDeck.Title>
              <hr style={{ borderColor: "black" }} />
              <PitchDeck.Description>When companies invite you, you automatically bypass CV screening and the first interview.</PitchDeck.Description>
            </PitchDeck.Content>
            <PitchDeck.Illustrations>
              <img src={tvAssets.gpDiscussion2} alt="Two people having a discussion" loading="lazy" decoding="async" />
            </PitchDeck.Illustrations>
          </PitchDeck>

          <PitchDeck number="03" bgColor="#C1F2B0" theme="light">
            <PitchDeck.Content pill="Why Join Jia Talent Vault">
              <PitchDeck.Title><em className="text-indigo no-italic">Perfect</em> your pitch</PitchDeck.Title>
              <hr style={{ borderColor: "black" }} />
              <PitchDeck.Description>
                Jia gives constructive, ethical feedback on your answers and helps you optimize how you{" "}
                present and market yourself — and you can retake your initial interview until you're ready to publish.
              </PitchDeck.Description>
            </PitchDeck.Content>
            <PitchDeck.Illustrations>
              <img className="gp-podcast" src={tvAssets.gpPodcast} alt="Man recording a podcast" loading="lazy" decoding="async" />
            </PitchDeck.Illustrations>
          </PitchDeck>

          <PitchDeck number="04" bgColor="#CF98FF" theme="light">
            <PitchDeck.Content pill="Why Join Jia Talent Vault">
              <PitchDeck.Title>Stay <em className="text-indigo no-italic">safe</em> and in control</PitchDeck.Title>
              <hr style={{ borderColor: "black" }} />
              <PitchDeck.Description>
                Only well-vetted employers can contact you — and you choose which types of companies can reach out.
              </PitchDeck.Description>
            </PitchDeck.Content>
            <PitchDeck.Illustrations>
              <img src={tvAssets.gpKeyLock} alt="Key, Lock, and Password Security Chain" loading="lazy" decoding="async" />
            </PitchDeck.Illustrations>
          </PitchDeck>
        </div>
      </section>

      <InvitationSection
        title="Ready to secure jobs?"
        message="Join the Jia Talent Vault along to find your perfect job match"
      >
        <InvitationSection.CTA>
          <Button 
            size="large" 
            variant="primary" 
            label="Sign up now"
            onClick={() => setModalType("signIn")} 
            pill
          />
        </InvitationSection.CTA>
      </InvitationSection>
    </main>
  )
}
