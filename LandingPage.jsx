import "./LandingPage.css";

function LandingPage() {
  return (
    <div className="landing-container">
      <h1 className="text-4xl font-bold text-white mb-8">Thomas Disney</h1>
      <p className="text-lg text-gray-300 mb-8">Material Flow & Robotics Enthusiast | Explore my work and resources</p>
      <div className="link-grid">
        <a href="https://tdisney.com" className="link-btn">SlipBot Simulator</a>
        <a href="https://x.com/TomGDisney" className="link-btn">Me on X.com</a>
        <a href="https://marsrec.com" className="link-btn">Martian Recreation Company</a>
      </div>
      <a href="/login" className="mt-8 inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
        Submit a ticket
      </a>
    </div>
  );
}

export default LandingPage;
