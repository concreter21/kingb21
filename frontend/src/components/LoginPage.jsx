import React, { useState } from "react";
import { Mail, Lock } from "lucide-react";
import { GoogleIcon, MicrosoftIcon, FacebookIcon, AppleIcon } from "./SocialIcons";
import { useToast } from "../hooks/use-toast";
import { APP_NAME, APP_SUBTITLE } from "../mock";

const providerIcons = {
  google: GoogleIcon,
  microsoft: MicrosoftIcon,
  facebook: FacebookIcon,
  apple: AppleIcon,
};

const socialButtons = [
  { id: "google", label: "Continue with Google" },
  { id: "microsoft", label: "Continue with Microsoft" },
  { id: "facebook", label: "Continue with Facebook" },
  { id: "apple", label: "Continue with Apple" },
];

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSocial = (providerId) => {
    toast({
      title: "Redirecting…",
      description: `Signing in with ${providerId.charAt(0).toUpperCase() + providerId.slice(1)}`,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Missing fields",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast({
        title: "Welcome back",
        description: "Signed in successfully (demo).",
      });
    }, 900);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f6f8fb] px-4 py-10 font-inter">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(15,23,42,0.15)] border border-slate-100 px-8 py-9 sm:px-10 sm:py-10">
        {/* Logo */}
        <div className="flex justify-center mb-5">
          <div className="relative w-[74px] h-[74px] rounded-full bg-[#6b21a8] flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(107,33,168,0.55)]">
            <span className="text-white font-bold text-[22px] tracking-tight leading-none">
              1K5
            </span>
            <span className="absolute top-3 right-3 text-[10px] text-cyan-300 font-bold">°</span>
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-center text-[26px] leading-[1.25] font-semibold text-slate-900 tracking-tight">
          Welcome to {APP_NAME.split(" ")[0]}
          <br />
          {APP_NAME.split(" ").slice(1).join(" ")}
        </h1>
        <p className="text-center text-[14px] text-slate-500 mt-2 mb-7">
          {APP_SUBTITLE}
        </p>

        {/* Social buttons */}
        <div className="flex flex-col gap-2.5">
          {socialButtons.map((btn) => {
            const Icon = providerIcons[btn.id];
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => handleSocial(btn.id)}
                className="w-full h-11 flex items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white text-[14px] font-medium text-slate-800 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.99] transition-colors duration-150 transition-transform"
              >
                <Icon className="w-[18px] h-[18px]" />
                <span>{btn.label}</span>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-[12px] text-slate-400 tracking-wider">OR</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* Email + Password Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[13px] text-slate-600 mb-1.5 font-medium">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-11 pl-10 pr-3 rounded-lg border border-slate-200 bg-white text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] text-slate-600 mb-1.5 font-medium">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 pl-10 pr-3 rounded-lg border border-slate-200 bg-white text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-1 rounded-lg bg-[#0f172a] text-white text-[14px] font-medium hover:bg-[#1e293b] active:scale-[0.99] transition-colors duration-150 transition-transform disabled:opacity-70"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Footer links */}
        <div className="flex items-center justify-between mt-5 text-[13px]">
          <button
            type="button"
            onClick={() =>
              toast({
                title: "Password reset",
                description: "A reset link would be sent to your email.",
              })
            }
            className="text-slate-500 hover:text-slate-800 transition-colors"
          >
            Forgot password?
          </button>
          <div className="text-slate-500">
            Need an account?{" "}
            <button
              type="button"
              onClick={() =>
                toast({
                  title: "Sign up",
                  description: "Registration flow (demo).",
                })
              }
              className="text-slate-900 font-medium hover:underline"
            >
              Sign up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
