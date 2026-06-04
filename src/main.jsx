import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import AppleSiliconTable from "./AppleSiliconTable.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppleSiliconTable />
  </StrictMode>
);
