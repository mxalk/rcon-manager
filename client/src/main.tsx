// Source-available: commercial use requires explicit written permission from the Licensor.
// See LICENSE and NOTICE in the repository root.
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.js";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
