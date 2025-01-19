import { createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";

import { routeTree } from "./routeTree.gen";

const router = (queryClient: QueryClient) =>
  createRouter({
    routeTree,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0, // To not handle caching / data fetching for routes using tanstack router since we will be using tanstack query to do those
    context: { queryClient },
  });

export default router;
