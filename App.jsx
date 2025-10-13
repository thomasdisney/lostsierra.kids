import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./LandingPage";
import Dashboard from "./Dashboard";
import SimulatorV2 from "./SimulatorV2";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/simulator-v2" element={<SimulatorV2 />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
