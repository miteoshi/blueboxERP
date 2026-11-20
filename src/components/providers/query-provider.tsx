'use client'

import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import { offlineStorage, QUERY_CACHE_KEY } from '@/lib/offline/storage'

// How long data loaded on this device stays usable without a connection
const OFFLINE_MAX_AGE = 7 * 24 * 60 * 60 * 1000

// Bump when the shape of cached data changes in a way old copies would break.
// 2: financial_position() gained gst, loans and capital
// 3: financial_position() gained fixed_assets
// 4: financial_position() gained tds; supplier payments gained TDS columns
const CACHE_VERSION = '4'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create client inside component so each browser session gets
  // its own cache — avoids data leaking between users on SSR
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Keep data fresh for 60 seconds before refetching
            staleTime: 60 * 1000,
            // Retry failed queries once before showing error
            retry: 1,
            // Refetch when user returns to the tab
            refetchOnWindowFocus: true,
            // Try the network once even when the browser says it is offline,
            // then keep showing what is already held instead of waiting
            networkMode: 'offlineFirst',
            // Must outlive OFFLINE_MAX_AGE or saved data is dropped on restore
            gcTime: OFFLINE_MAX_AGE,
          },
          mutations: {
            retry: 0,
            // A save made offline fails at once with a clear message. It is
            // never held back and sent later without the user knowing.
            networkMode: 'always',
          },
        },
      })
  )

  const [persister] = useState(() =>
    createAsyncStoragePersister({
      storage: typeof indexedDB === 'undefined' ? undefined : offlineStorage,
      key: QUERY_CACHE_KEY,
      throttleTime: 2000,
      // A refetch that failed for want of a connection leaves the query in
      // an error state while still holding its last good data. Save that
      // data as the good copy it is, or it would be thrown away the first
      // time the app is used offline.
      serialize: (client) =>
        JSON.stringify({
          ...client,
          clientState: {
            ...client.clientState,
            queries: client.clientState.queries.map((query) =>
              query.state.status === 'error'
                ? {
                    ...query,
                    state: {
                      ...query.state,
                      status: 'success',
                      error: null,
                      errorUpdateCount: 0,
                      errorUpdatedAt: 0,
                      fetchFailureCount: 0,
                      fetchFailureReason: null,
                    },
                  }
                : query
            ),
          },
        }),
    })
  )

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: OFFLINE_MAX_AGE,
        buster: CACHE_VERSION,
        dehydrateOptions: {
          // Keep every query that holds data, including one whose latest
          // refetch failed; never keep a query that has none
          shouldDehydrateQuery: (query) => query.state.data !== undefined,
          // A save is never carried over to be sent later
          shouldDehydrateMutation: () => false,
        },
      }}
      // What was restored is only a stand-in until the server answers:
      // refetch everything on screen, and above all who the user is.
      onSuccess={() => {
        void queryClient.invalidateQueries()
      }}
    >
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </PersistQueryClientProvider>
  )
}
