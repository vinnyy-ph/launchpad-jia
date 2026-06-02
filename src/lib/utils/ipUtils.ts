import { NextRequest } from "next/server";

export interface ClientGeoData {
  ip: string;
  city?: string;
  country?: string;
  region?: string;
  latitude?: string;
  longitude?: string;
}

export function getClientGeoData(request: NextRequest | Request): ClientGeoData {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1";

  const city = request.headers.get("x-vercel-ip-city") || undefined;
  const country = request.headers.get("x-vercel-ip-country") || undefined;
  const region = request.headers.get("x-vercel-ip-region") || undefined;
  const latitude = request.headers.get("x-vercel-ip-latitude") || undefined;
  const longitude = request.headers.get("x-vercel-ip-longitude") || undefined;

  return {
    ip,
    city,
    country,
    region,
    latitude,
    longitude,
  };
}
