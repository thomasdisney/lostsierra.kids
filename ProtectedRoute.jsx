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

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (isAuthenticated === null) return <div className="text-white text-center">Loading...</div>;
  return isAuthenticated ? children : <Navigate to="/login" />;
}

export default ProtectedRoute;
