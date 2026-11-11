import "@fontsource/noto-serif-malayalam/400.css";
import "@fontsource/noto-serif-malayalam/600.css";
import "@fontsource/noto-sans-malayalam/400.css";
import "@fontsource/noto-sans-malayalam/600.css";
import "./styles.css";
import { createRoot } from "react-dom/client";
import { HashRouter, MemoryRouter, Route, Routes } from "react-router-dom";
import { IS_ARTIFACT } from "./env";
import IndexPage from "./pages/IndexPage";
import WritePage from "./pages/WritePage";
import ReadPage from "./pages/ReadPage";

const Router = IS_ARTIFACT ? MemoryRouter : HashRouter;

createRoot(document.getElementById("root")!).render(
  <Router>
    <Routes>
      <Route path="/" element={<IndexPage />} />
      <Route path="/novel/:id" element={<WritePage />} />
      <Route path="/novel/:id/read" element={<ReadPage />} />
      <Route path="*" element={<IndexPage />} />
    </Routes>
  </Router>,
);

// Typewriter splash (see index.html) types its line and then waits for this signal before fading out.
(window as unknown as { __twReady?: boolean; __twTryClose?: () => void }).__twReady = true;
(window as unknown as { __twTryClose?: () => void }).__twTryClose?.();
