import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { DatabaseProvider } from "./DatabaseContext.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <DatabaseProvider>
      <App />
    </DatabaseProvider>
  </React.StrictMode>,
);
