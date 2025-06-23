import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getUser } from "./auth";

function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    async function checkAuth() {
      const { data, error } = await getUser();
      setIsAuthenticated(!!data.user && !error);
    }
    checkAuth();
  }, []);

  if (isAuthenticated === null) return <div>Loading...</div>;
  return isAuthenticated ? children : <Navigate to="/login" />;
}

export default ProtectedRoute;
