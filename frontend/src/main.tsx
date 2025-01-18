import React from "react";
import { RouterProvider } from "@tanstack/react-router";

import ReactDOM from "react-dom/client";

import router from "./app/router/router";

const rootElement = document.getElementById("app")!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<RouterProvider router={router} />);
}
