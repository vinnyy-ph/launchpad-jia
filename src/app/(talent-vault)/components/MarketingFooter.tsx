"use client";

import { tvAssets } from "@/lib/utils/constantsV2";
import Button from "./base/Button";
import { ArrowRight } from "./icons/ArrowRight";
import { NewsletterSubscribeForm } from "./NewsletterSubscribeForm";

export function MarketingFooter() {
  return (
    <div className="tv-marketing-footer-container">
      <footer className="tv-marketing-footer">
        <div className="tv-marketing-footer--left">
          <div className="tv-marketing-footer--info">
            <div className="tv-marketing-footer--brand">
              <img src={tvAssets.tvLogo} alt="Jia Talent Vault logo" width={166} height={40} />
              <div>
                <p>powered by White Cloak Technologies, Inc.</p>
                <p className="tv-marketing-footer--copyright">&copy; Copyright 2026. All rights reserved.</p>
              </div>
            </div>

            <div className="tv-marketing-footer--group">
              <h4 id="contact">Contact</h4>
              <div className="tv-marketing-footer--contact-info">
                <div className="tv-marketing-footer--contact-info-item">
                  <p>Sales Team: <a href="mailto:inquire@hellojia.ai" target="_blank">inquire@hellojia.ai</a></p>
                  <p>Development Team: <a href="mailto:hello@whitecloak.com" target="_blank">hello@whitecloak.com</a></p>
                </div>
                <div className="tv-marketing-footer--contact-info-item">
                  <p>20th Floor, F. Ortigas Jr Strata 2000 Building</p>
                  <p>San Antonio, Ortigas Center, Pasig, 1605 Metro Manila</p>
                </div>
              </div>
            </div>

            <div className="tv-marketing-footer--group">
              <h4>Careers at White Cloak</h4>
              <p>Join the most talented software development company in the country today.</p>

              <Button variant="primary" size="large" href="https://whitecloak-careers.hellojia.ai/job-openings" target="_blank">
                White Cloak Careers <ArrowRight size={16} />
              </Button>
            </div>
          </div>

          <div className="tv-marketing-footer--links">
            <div className="tv-marketing-footer--group">
              <h5>Talent Vault</h5>
              <ul>
                <li><a href="#how-it-works">About</a></li>
                <li><a href="#how-it-works">How it works</a></li>
                <li><a href="#why-it-works">Why it works</a></li>
              </ul>
            </div>

            <div className="tv-marketing-footer--group">
              <h5>Support</h5>
              <ul>
                <li><a href="/terms-of-service">Terms of Service</a></li>
                <li><a href="/privacy-policy">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="tv-marketing-footer--right">
          <div className="tv-marketing-footer--group">
            <h4>Stay up to date</h4>

            <NewsletterSubscribeForm />

            <p>Get the latest updates on Jia and more exclusive behind-the-scenes look on our production.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}