import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/axios";

export default function Redirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const res = await API.get("/user/profile");
        const profile = res.data.profile;

        if (profile.is_setup_complete) {
          navigate("/dashboard", { replace: true });
        } else {
          navigate("/setup", { replace: true });
        }
      } catch (err) {
        console.error("Redirect error:", err);
        navigate("/login", { replace: true });
      }
    };

    checkUser();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">
      Checking your profile...
    </div>
  );
}
