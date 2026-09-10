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
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
