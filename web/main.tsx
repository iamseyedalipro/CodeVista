import { createRoot } from "react-dom/client";
import { initializeTheme } from "./theme";
import App from "./App";
import "./styles.css";

initializeTheme();

createRoot(document.getElementById("root")!).render(<App />);
