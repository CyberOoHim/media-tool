import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getSpaRouter } from "./spa-router";
import "./styles.css";

const el = document.getElementById("root");
if (!el) throw new Error("Missing #root");

createRoot(el).render(
  <StrictMode>
    <RouterProvider router={getSpaRouter()} />
  </StrictMode>,
);
