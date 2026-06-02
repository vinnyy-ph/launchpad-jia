"use client";

import ErrorBoundary from "@/lib/components/ErrorBoundary";
import Script from "next/script";
import "./styles/tv.global.scss";
import { useEffect, useState } from "react";
import { tvAssets } from "@/lib/utils/constantsV2";

export default function TalentVaultLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/jia-logo-white-bg.svg" />
        <link href="https://fonts.cdnfonts.com/css/satoshi" rel="preload" as="style" />
        <link href="https://fonts.cdnfonts.com/css/satoshi" rel="stylesheet" />
        <link rel="preload" as="style" href="https://maxst.icons8.com/vue-static/landings/line-awesome/line-awesome/1.3.0/css/line-awesome.min.css" />
        <link id="line-awesome" rel="stylesheet" href="https://maxst.icons8.com/vue-static/landings/line-awesome/line-awesome/1.3.0/css/line-awesome.min.css" />

        {Object.values(tvAssets).map((url, index) => (
          <link key={index} as="image" href={url} rel="preload" />
        ))}

        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        <Script id="facebook-pixel" strategy="afterInteractive">
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

        <title>Jia Talent Vault | White Cloak Technologies, Inc.</title>
      </head>
      <body className="tv-app">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>

        <noscript>
          <img 
            height="1" 
            width="1" 
            src="https://www.facebook.com/tr?id=792457430272310&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>

        {mounted && (
          // LeadConnectorHQ Chat Widget
          <Script
            src="https://widgets.leadconnectorhq.com/loader.js"
            data-resources-url="https://widgets.leadconnectorhq.com/chat-widget/loader.js"
            data-widget-id="691a8d60fe7ae475de0c991a"
            strategy="lazyOnload"
          />
        )}
      </body>
    </html>
  )
}