import "@/lib/styles/argon.min.css";
import "../lib/styles/animations.scss";
import "../lib/styles/login.scss";
import "../lib/styles/chat-styles.scss";
import "../lib/styles/analysis.scss";
import "../lib/styles/whitecloak.scss";
import "../lib/styles/globals.scss";
import "../lib/styles/compose-email.scss";
import "../lib/styles/email-module.scss";
import "../lib/styles/sweetalert-overrides.scss";

import { headers } from "next/headers";
import { assetConstants } from "@/lib/utils/constantsV2";
import { GoogleTracking } from "../lib/components/GoogleTracking";
import Script from "next/script";
import ClientLayout from "./ClientLayout";

const DOMAIN_META: Record<string, { title: string; description: string; googleSiteVerification: string | null }> = {
  "hirejia.ai": {
    title: "JIA | AI-Powered End-to-End Hiring Tool",
    description:
      "Modernize your hiring process with cutting-edge AI. Automate pre-screening and candidate communication in real-time. Eliminate manual tracking and generate real-time insights for faster and better hiring.",
    googleSiteVerification: "R4CIt6mG4Ofcnj8TWv-euGJlmJvn5HvBWh2xhjycsag",
  },
  "hellojia.ai": {
    title: "Jia | A Smarter Job Portal for New Opportunities",
    description:
      "Discover job openings, urgent hiring roles, and apply online easily. Jia is a premier job portal that connects you with top-tier roles while ensuring the entire application process is faster, more transparent, and simply better.",
    googleSiteVerification: "2TCCazSZp1om__8ccPbJvMuE-E8upD0rrIQnxw29_u0",
  },
};

const DEFAULT_META = DOMAIN_META["hirejia.ai"];

function resolveDomainMeta(host: string) {
  for (const domain of Object.keys(DOMAIN_META)) {
    if (host === domain || host.endsWith(`.${domain}`)) {
      return DOMAIN_META[domain];
    }
  }
  return DEFAULT_META;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const host = (headersList.get("host") || "").replace(/:\d+$/, "");
  const domainMeta = resolveDomainMeta(host);
  const nonce = headersList.get("x-nonce") || "";

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
          rel="preload"
          as="style"
        />
        <link
          href="https://fonts.cdnfonts.com/css/satoshi"
          rel="preload"
          as="style"
        />
        <link href="https://fonts.cdnfonts.com/css/satoshi" rel="stylesheet" />
        {/* Fonts */}

        {/* Leaflet CSS for maps */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />

        {/* Leaflet CSS for maps */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />

        {/* Line Awesome */}
        <link
          rel="preload"
          as="style"
          href="https://maxst.icons8.com/vue-static/landings/line-awesome/line-awesome/1.3.0/css/line-awesome.min.css"
        />
        <link
          id="line-awesome"
          rel="stylesheet"
          href="https://maxst.icons8.com/vue-static/landings/line-awesome/line-awesome/1.3.0/css/line-awesome.min.css"
        />
        {/* Line Awesome */}

        {/* Metadata */}
        <link rel="icon" href="/jia-logo-white-bg.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{domainMeta.title}</title>
        <meta name="description" content={domainMeta.description} />
        {domainMeta.googleSiteVerification && (
          <meta name="google-site-verification" content={domainMeta.googleSiteVerification} />
        )}
        {/* Metadata */}

        {/* Preload Images */}
        {Object.values(assetConstants).map((url, index) => (
          <link key={index} as="image" href={url} rel="preload" />
        ))}
        <GoogleTracking nonce={nonce} />

        <Script id="facebook-pixel" strategy="afterInteractive" nonce={nonce}>
        {`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window,document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '792457430272310'); 
        fbq('track', 'PageView');
        `}
        </Script>
        <noscript>
          <img 
            height="1" 
            width="1" 
            src="https://www.facebook.com/tr?id=792457430272310&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
      </head>

      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
