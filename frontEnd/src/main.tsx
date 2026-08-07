import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Inspection blocking is disabled for this app.
createRoot(document.getElementById("root")!).render(<App />);
