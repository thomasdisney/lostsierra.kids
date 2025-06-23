import "./LandingPage.css";
import { useNavigate } from "react-router-dom";

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      <h1 className="text-4xl font-bold text-white mb-8">Thomas Disney</h1>
      <p className="text-lg text-gray-300 mb-8">material flow & robotics enthusiast | explore my work and resources</p>
      <div className="link-grid">
        <a href="https://tdisney.com" className="link-btn">SlipBot Simulator</a>
        <a href="https://x.com/TomGDisney" className="link-btn">me on X.com</a>
        <a href="https://marsrec.com" className="link-btn">Martian Recreation Company</a>
      </div>
      <button
        onClick={() => navigate("/dashboard")}
        className="mt-8 inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
      >
        submit a ticket
      </button>
    </div>
  );
}

export default LandingPage;


