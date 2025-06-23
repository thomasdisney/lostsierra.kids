import "./LandingPage.css";

function LandingPage() {
  return (
    <div className="landing-container">
      <h1 className="text-4xl font-bold text-white mb-8">Welcome</h1>
      <p className="text-lg text-gray-300 mb-8">Explore my work and resources.</p>
      <div className="link-grid">
        <a href="https://github.com" className="link-btn">GitHub</a>
        <a href="https://linkedin.com" className="link-btn">LinkedIn</a>
        <a href="/resume.pdf" className="link-btn">Resume</a>
      </div>
      <a href="/login" className="mt-8 inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
        Login to Dashboard
      </a>
    </div>
  );
}

export default LandingPage;
