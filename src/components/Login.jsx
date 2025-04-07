import { useState } from "react";
import { supabase } from "../utils/supabase";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [sent, setSent] = useState(false);

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) alert("Login failed: " + error.message);
    else setSent(true);
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
    });
    if (error) {
      console.error("❌ Google sign-in error:", error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
      <div className="card w-96 bg-base-100 shadow-xl">
        <div className="card-body items-center text-center">
          <h2 className="card-title text-2xl font-bold mb-6">QUIZ MASTER</h2>
          
          {sent ? (
            <div className="text-success">
              ✅ Check your email for the magic login link!
            </div>
          ) : showEmailInput ? (
            <div className="w-full space-y-4">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input input-bordered w-full"
              />
              <button 
                className="btn btn-success w-full" 
                onClick={handleLogin}
              >
                Send magic link
              </button>
              <button 
                className="btn btn-ghost btn-sm w-full"
                onClick={() => setShowEmailInput(false)}
              >
                ← Back to options
              </button>
            </div>
          ) : (
            <div className="w-full space-y-4">
              <button 
                className="btn btn-outline w-full normal-case"
                onClick={signInWithGoogle}
              >
                <img 
                  src="https://www.google.com/favicon.ico" 
                  alt="Google" 
                  className="w-5 h-5 mr-2"
                />
                Log in with Google
              </button>
              <button 
                className="btn btn-outline w-full"
                onClick={() => setShowEmailInput(true)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                Log in with Email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
