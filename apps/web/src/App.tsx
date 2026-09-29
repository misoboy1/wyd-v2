import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import { useBootstrapData, useLiveUpdates } from "@/lib/data";
import { AppShell, RequireAuth } from "@/components/layout/AppShell";
import { ConflictDialog } from "@/components/layout/ConflictDialog";
import { ConfirmHost } from "@/components/ui/confirm";
import { Skeleton } from "@/components/ui/misc";

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Prep = lazy(() => import("@/pages/Prep"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const Visitors = lazy(() => import("@/pages/Visitors"));
const Facilities = lazy(() => import("@/pages/Facilities"));
const Homestays = lazy(() => import("@/pages/Homestays"));
const Org = lazy(() => import("@/pages/Org"));
const Volunteers = lazy(() => import("@/pages/Volunteers"));
const Notices = lazy(() => import("@/pages/Notices"));
const Posts = lazy(() => import("@/pages/Posts"));
const Qna = lazy(() => import("@/pages/Qna"));
const Places = lazy(() => import("@/pages/Places"));
const Gori = lazy(() => import("@/pages/Gori"));
const Users = lazy(() => import("@/pages/Users"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function Live() {
  useBootstrapData();
  useLiveUpdates();
  return null;
}
const Loading = () => (
  <div className="space-y-3">
    <Skeleton className="h-9 w-56" />
    <Skeleton className="h-28" />
    <Skeleton className="h-64" />
  </div>
);
const P = ({ children, auth, roles }: { children: ReactNode; auth?: boolean; roles?: string[] }) => (
  <Suspense fallback={<Loading />}>{auth ? <RequireAuth roles={roles}>{children}</RequireAuth> : children}</Suspense>
);

export function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Live />
          <Routes>
            <Route element={<AppShell />}>
              <Route
                index
                element={
                  <P>
                    <Dashboard />
                  </P>
                }
              />
              <Route
                path="prep"
                element={
                  <P>
                    <Prep />
                  </P>
                }
              />
              <Route
                path="schedule"
                element={
                  <P>
                    <Schedule />
                  </P>
                }
              />
              <Route
                path="visitors"
                element={
                  <P auth>
                    <Visitors />
                  </P>
                }
              />
              <Route
                path="facilities"
                element={
                  <P auth>
                    <Facilities />
                  </P>
                }
              />
              <Route
                path="homestays"
                element={
                  <P auth>
                    <Homestays />
                  </P>
                }
              />
              <Route
                path="org"
                element={
                  <P auth>
                    <Org />
                  </P>
                }
              />
              <Route
                path="volunteers"
                element={
                  <P auth>
                    <Volunteers />
                  </P>
                }
              />
              <Route
                path="notices"
                element={
                  <P>
                    <Notices />
                  </P>
                }
              />
              <Route
                path="posts"
                element={
                  <P auth>
                    <Posts />
                  </P>
                }
              />
              <Route
                path="qna"
                element={
                  <P>
                    <Qna />
                  </P>
                }
              />
              <Route
                path="places"
                element={
                  <P>
                    <Places />
                  </P>
                }
              />
              <Route
                path="gori"
                element={
                  <P>
                    <Gori />
                  </P>
                }
              />
              <Route
                path="admin/users"
                element={
                  <P auth roles={["admin"]}>
                    <Users />
                  </P>
                }
              />
              <Route
                path="*"
                element={
                  <P>
                    <NotFound />
                  </P>
                }
              />
            </Route>
          </Routes>
          <ConflictDialog />
          <ConfirmHost />
        </BrowserRouter>
        <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: "inherit" } }} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
