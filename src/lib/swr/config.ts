import { SWRConfiguration } from 'swr';
import { api } from '@/lib/utils/apiClient';

// SWR fetcher for API requests
export const swrFetcher = async (url: string) => {
  const response = await api.get(url);
  return response.data;
};

// Global SWR configuration
// Applied to all SWR hooks throughout the app
export const swrConfig: SWRConfiguration = {
  fetcher: swrFetcher,
  revalidateOnFocus: false,      // Push handles updates, no need for focus revalidation
  revalidateOnReconnect: true,   // Refresh when connection restored
  dedupingInterval: 2000,        // Dedupe requests within 2 seconds
  errorRetryCount: 3,            // Retry failed requests up to 3 times
  errorRetryInterval: 5000,      // Wait 5 seconds between retries
  refreshInterval: 0,            // No polling - push-based updates
};
