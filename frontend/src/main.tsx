import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import router from "~/app/router/router";
import ReactDOM from "react-dom/client";

import "~/styles/globals.css";

const queryClient = new QueryClient();
const routerWithQueryClient = router(queryClient);

const rootElement = document.getElementById("app")!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={routerWithQueryClient} />
    </QueryClientProvider>,
  );
}
