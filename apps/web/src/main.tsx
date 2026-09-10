import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth";
import { Layout } from "./components/Layout";
import "./index.css";
import { Board } from "./pages/Board";
import { BountyDetail } from "./pages/BountyDetail";
import { Create } from "./pages/Create";
import { How } from "./pages/How";
import { RolePick } from "./pages/RolePick";
import { Work } from "./pages/Work";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Board />} />
            <Route path="/new" element={<Create />} />
            <Route path="/b/:id" element={<BountyDetail />} />
            <Route path="/how" element={<How />} />
            <Route path="/role" element={<RolePick />} />
            <Route path="/work" element={<Work />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
