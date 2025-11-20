import "./LandingPage.css";
import { useNavigate } from "react-router-dom";

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      <h1 className="text-4xl font-bold text-white mb-8">Thomas Disney</h1>
      <p className="text-lg text-gray-300 mb-8">material flow & robotics enthusiast | explore my work and resources</p>
      <div className="link-grid">
        <button onClick={() => navigate("/simulator-v2")} className="link-btn">
          Slipbot Simulator V2
        </button>
        <button onClick={() => navigate("/dashboard")} className="link-btn">
          Deployment Tracker
        </button>
        <button onClick={() => navigate("/example-wms")} className="link-btn">
          example WMS
        </button>
        <a href="https://tdisney.com" className="link-btn">SlipBot Simulator</a>
        <a href="https://x.com/TomGDisney" className="link-btn">me on X.com</a>
        <a href="https://marsrec.com" className="link-btn">Martian Recreation Company</a>
      </div>
    </div>
  );
}

export default LandingPage;


