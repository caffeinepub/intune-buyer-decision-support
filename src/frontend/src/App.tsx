import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Navigate,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import { Dashboard } from "./pages/Dashboard";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MarkdownModule } from "./pages/MarkdownModule";
import { RebuySize } from "./pages/RebuySize";
import { Reports } from "./pages/Reports";
import { StyleAnalysis } from "./pages/StyleAnalysis";

const queryClient = new QueryClient();

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/home",
  component: () => (
    <ProtectedRoute>
      <HomePage />
    </ProtectedRoute>
  ),
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  ),
});

const styleAnalysisRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/style-analysis",
  component: () => (
    <ProtectedRoute>
      <StyleAnalysis />
    </ProtectedRoute>
  ),
});

const rebuySizeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/rebuy-size",
  component: () => (
    <ProtectedRoute>
      <RebuySize />
    </ProtectedRoute>
  ),
});

const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reports",
  component: () => (
    <ProtectedRoute>
      <Reports />
    </ProtectedRoute>
  ),
});

const markdownRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/markdown",
  component: () => (
    <ProtectedRoute>
      <MarkdownModule />
    </ProtectedRoute>
  ),
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  homeRoute,
  dashboardRoute,
  styleAnalysisRoute,
  rebuySizeRoute,
  reportsRoute,
  markdownRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DataProvider>
          <RouterProvider router={router} />
          <Toaster richColors position="top-right" />
        </DataProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
