"use client";

import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import { AppContextProvider } from "../lib/context/AppContext";
import { Suspense } from "react";
import FullPageLoader from "@/lib/components/Loaders/FullPageLoader";
import ErrorBoundary from "@/lib/components/ErrorBoundary";
import { ParallaxProvider } from "react-scroll-parallax";
import GoogleChromeToolbar from "@/lib/components/GoogleChromeToolbar";
import ClientLayout from "./ClientLayout";
import { SWRConfig } from 'swr';
import { swrConfig } from '@/lib/swr/config';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GoogleChromeToolbar />
      <ErrorBoundary>
        <Suspense fallback={<FullPageLoader />}>
          <SWRConfig value={swrConfig}>
            <ParallaxProvider>
              <AppContextProvider>
                <ClientLayout>{children}</ClientLayout>
              </AppContextProvider>
            </ParallaxProvider>
          </SWRConfig>
        </Suspense>
      </ErrorBoundary>
      <ToastContainer />
    </>
  );
}
