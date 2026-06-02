"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";

interface GoogleTrackingProps {
  nonce?: string;
}

export function GoogleTracking({ nonce }: GoogleTrackingProps) {
  const gaIdRef = useRef<string | null>(null);
  const adsIdRef = useRef<string | null>(null);
  const [loadedGoogleIds, setLoadedGoogleIds] = useState<boolean>(false);
  useEffect(() => {
    const cookies = Object.fromEntries(
      document.cookie.split("; ").map((c) => c.split("="))
    );
    const cookieGaId = cookies["ga-id"];
    const cookieAdsId = cookies["ads-id"];

    if (cookieGaId) {
      gaIdRef.current = cookieGaId;
    }

    if (cookieAdsId) {
      adsIdRef.current = cookieAdsId;
    }

    if (gaIdRef.current || adsIdRef.current) {
      setLoadedGoogleIds(true);
    }
  }, []);

  return (loadedGoogleIds && gaIdRef.current && (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaIdRef.current}`} strategy="afterInteractive" nonce={nonce} />
			<Script id="google-analytics" strategy="afterInteractive" nonce={nonce}>
				{`
				window.dataLayer = window.dataLayer || [];
				function gtag(){window.dataLayer.push(arguments);}
				gtag('js', new Date());

				gtag('config', '${gaIdRef.current}');
        ${adsIdRef.current && `gtag('config', '${adsIdRef.current}');`}
				`}
			</Script>
    </>
  ));
}
