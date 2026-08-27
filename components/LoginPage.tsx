import React, { useState, useRef, useEffect, memo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Spinner from './Spinner';

const LoginPage: React.FC = () => {
 const { login, isLoading: authLoading } = useAuth();
 const [username, setUsername] = useState('');
 const [password, setPassword] = useState('');
 const [showPassword, setShowPassword] = useState(false);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const usernameRef = useRef<HTMLInputElement>(null);

 useEffect(() => {
 document.body.classList.add('view-login');
 usernameRef.current?.focus();
 return () => {
 document.body.classList.remove('view-login');
 };
 }, []);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (isSubmitting || !username.trim() || !password) return;

 setIsSubmitting(true);
 setError(null);

 const result = await login(username, password);

 if (!result.success) {
 setError(result.message);
 }

 setIsSubmitting(false);
 };

 const isDark = false;
 return (
 <div className="login-page-wrapper">
 <div className="login-card">
 {/* Logo / Brand */}
 <div className="login-brand">
 <div className="login-logo-ring">
 <svg className="w-10 h-10 fill-current text-white login-logo-icon" viewBox="0 0 720 720" xmlns="http://www.w3.org/2000/svg">
 <path d="M456.55,38.52H267.52c-4.19,0-8.07,2.2-10.21,5.8L137.03,246.21c-2.14,3.6-6.02,5.8-10.21,5.8H25.41
 c-9.22,0-14.93,10.05-10.21,17.97l113.23,190.04c2.14,3.6,6.02,5.8,10.21,5.8h189.04c9.22,0,14.93-10.05,10.21-17.97L232.1,270.3
 c-4.72-7.92,0.99-17.97,10.21-17.97h101.02c4.19,0,8.07-2.2,10.21-5.8L466.77,56.49C471.49,48.57,465.78,38.52,456.55,38.52z"/>
 <path d="M263.45,681.48h189.04c4.19,0,8.07-2.2,10.21-5.8l120.28-201.88c2.14-3.6,6.02-5.8,10.21-5.8h101.4
 c9.22,0,14.93-10.05,10.21-17.97L591.57,259.99c-2.14-3.6-6.02-5.8-10.21-5.8H392.33c-9.22,0-14.93,10.05-10.21,17.97L487.9,449.7
 c4.72,7.92-0.99,17.97-10.21,17.97H376.67c-4.19,0-8.07,2.2-10.21,5.8L253.23,663.51C248.51,671.43,254.22,681.48,263.45,681.48z"/>
 </svg>
 </div>
 <h1 className="login-title">
 <span className="login-title-brand sora-brand">Sebellas</span>
 </h1>
 <p className="login-subtitle">Masuk untuk menggunakan Prompt Generator</p>
 </div>

 {/* Form */}
 <form onSubmit={handleSubmit} className="login-form" noValidate>
 {/* Username */}
 <div className="login-field">
 <label htmlFor="login-username" className="login-label">
 <span className="material-symbols-outlined login-label-icon">person</span>
 Username
 </label>
 <div className="login-input-wrapper">
 <input
 ref={usernameRef}
 id="login-username"
 type="text"
 autoComplete="username"
 value={username}
 onChange={e => { setUsername(e.target.value); setError(null); }}
 className="login-input"
 placeholder="Masukkan username"
 disabled={isSubmitting}
 required
 />
 </div>
 </div>

 {/* Password */}
 <div className="login-field">
 <label htmlFor="login-password" className="login-label">
 <span className="material-symbols-outlined login-label-icon">lock</span>
 Password
 </label>
 <div className="login-input-wrapper login-input-password-wrapper">
 <input
 id="login-password"
 type={showPassword ? 'text' : 'password'}
 autoComplete="current-password"
 value={password}
 onChange={e => { setPassword(e.target.value); setError(null); }}
 className="login-input login-input-password"
 placeholder="Masukkan password"
 disabled={isSubmitting}
 required
 />
 <button
 type="button"
 className="login-show-password-btn"
 onClick={() => setShowPassword(v => !v)}
 tabIndex={-1}
 aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
 >
 <span className="material-symbols-outlined">
 {showPassword ? 'visibility_off' : 'visibility'}
 </span>
 </button>
 </div>
 </div>

 {/* Error */}
 {error && (
 <div className="login-error" role="alert">
 <span className="material-symbols-outlined login-error-icon">error</span>
 {error}
 </div>
 )}

 {/* Submit */}
 <button
 type="submit"
 className="btn btn-primary generation-main-btn w-full mt-2"
 disabled={isSubmitting || !username.trim() || !password}
 style={{ minHeight: '48px', justifyContent: 'center' }}
 >
 {isSubmitting ? (
 <span className="generation-btn-loading-content inline-flex items-center justify-center">
 <Spinner size="w-[18px] h-[18px]" color="border-white" />
 <span className="generation-btn-loading-label ml-2">Memverifikasi...</span>
 </span>
 ) : (
 <span className="generation-btn-content inline-flex items-center justify-center">
 <span className="material-symbols-outlined generation-btn-icon">login</span>
 <span className="generation-btn-label ml-2">Masuk</span>
 </span>
 )}
 </button>
 </form>

 {/* Footer hint */}
 <p className="login-footer-hint">
 Belum punya akun? Hubungi admin untuk mendapatkan akses.
 </p>
 </div>

 <style>{`
 /* === Login Page Wrapper === */
 .login-page-wrapper {
 position: fixed;
 inset: 0;
 display: flex;
 align-items: center;
 justify-content: center;
 padding: 1.5rem;
 overflow: hidden;
 background: transparent;
 z-index: 1;
 }
 .login-page-wrapper::before {
 content: none !important;
 display: none !important;
 }
 body.theme-light .login-page-wrapper::before {
 content: none !important;
 display: none !important;
 }

 /* === Card === */
 .login-card {
 position: relative;
 z-index: 2;
 width: 100%;
 max-width: 420px;
 border-radius: 1.5rem;
 padding: 2.5rem 2rem;
 }
 body.theme-light .login-card {
 background: #FFFFFF;
 border: 1px solid #E5E7EB;
 box-shadow:
 0 4px 6px -1px rgba(0,0,0,0.07),
 0 20px 60px -10px rgba(99, 102, 241, 0.12);
 }
 body.theme-dark .login-card {
 background: #1A1A1A;
 border: 1px solid #2C2C2C;
 box-shadow:
 0 4px 6px -1px rgba(0,0,0,0.4),
 0 20px 60px -10px rgba(0,0,0,0.6);
 }
 /* === Brand === */
 .login-brand {
 display: flex;
 flex-direction: column;
 align-items: center;
 margin-bottom: 2rem;
 text-align: center;
 }
 .login-logo-ring {
 width: 64px; height: 64px;
 border-radius: 1rem;
 display: flex;
 align-items: center;
 justify-content: center;
 margin-bottom: 1rem;
 position: relative;
 }
 body.theme-light .login-logo-ring {
 background: linear-gradient(135deg, #6366F1, #8B5CF6);
 box-shadow: 0 8px 24px rgba(99,102,241,0.35);
 }
 body.theme-dark .login-logo-ring {
 background: linear-gradient(135deg, #818CF8, #A78BFA);
 box-shadow: 0 8px 24px rgba(129,140,248,0.3);
 }
 .login-logo-icon {
 font-size: 2rem !important;
 color: white;
 font-variation-settings: 'FILL' 1, 'wght' 400;
 }

 .login-title {
 font-family: 'Manrope', sans-serif;
 font-weight: 800;
 font-size: 1.75rem;
 line-height: 1.2;
 margin: 0 0 0.25rem 0;
 }
 body.theme-light .login-title-brand { color: #4F46E5; }
 body.theme-dark .login-title-brand { color: #818CF8; }
 body.theme-light .login-title-suffix { color: #6366F1; font-weight: 600; }
 body.theme-dark .login-title-suffix { color: #818CF8; font-weight: 600; }
 .login-subtitle {
 font-size: 0.8125rem;
 margin: 0;
 }
 body.theme-light .login-subtitle { color: #6B7280; }
 body.theme-dark .login-subtitle { color: #A9A9A9; }
 /* === Form === */
 .login-form {
 display: flex;
 flex-direction: column;
 gap: 1.125rem;
 }
 .login-field {
 display: flex;
 flex-direction: column;
 gap: 0.375rem;
 }
 .login-label {
 display: flex;
 align-items: center;
 gap: 0.375rem;
 font-size: 0.8125rem;
 font-weight: 600;
 }
 body.theme-light .login-label { color: #374151; }
 body.theme-dark .login-label { color: #D1D5DB; }
 .login-label-icon {
 font-size: 1rem !important;
 }
 .login-input-wrapper {
 position: relative;
 }
 .login-input {
 width: 100%;
 box-sizing: border-box;
 padding: 0.75rem 1rem;
 border-radius: 0.75rem;
 font-size: 0.9375rem;
 font-family: 'Manrope', sans-serif;
 transition: all 0.2s ease;
 outline: none;
 border: 1.5px solid;
 }
 .login-input-password {
 padding-right: 3rem;
 }
 body.theme-light .login-input {
 background: #F9FAFB;
 border-color: #E5E7EB;
 color: #111827;
 }
 body.theme-light .login-input::placeholder { color: #9CA3AF; }
 body.theme-light .login-input:focus {
 border-color: #6366F1;
 background: #fff;
 box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
 }
 body.theme-dark .login-input {
 background: #252525;
 border-color: #3D3D3D;
 color: #F0F0F0;
 }
 body.theme-dark .login-input::placeholder { color: #6F6F6F; }
 body.theme-dark .login-input:focus {
 border-color: #818CF8;
 box-shadow: 0 0 0 3px rgba(129,140,248,0.2);
 }
 .login-input:disabled {
 opacity: 0.6;
 cursor: not-allowed;
 }

 .login-input-password-wrapper {
 position: relative;
 }
 .login-show-password-btn {
 position: absolute;
 right: 0.75rem;
 top: 0;
 bottom: 0;
 margin: auto 0;
 transform: none;
 background: none;
 border: none;
 cursor: pointer;
 width: 28px;
 height: 28px;
 padding: 0;
 display: flex;
 align-items: center;
 justify-content: center;
 border-radius: 0.375rem;
 transition: opacity 0.2s;
 }
 .login-show-password-btn:hover { opacity: 0.7; }
 .login-show-password-btn .material-symbols-outlined {
 display: block;
 position: relative;
 top: 0.5px;
 font-size: 1.125rem !important;
 line-height: 1;
 }
 body.theme-light .login-show-password-btn .material-symbols-outlined { color: #9CA3AF; }
 body.theme-dark .login-show-password-btn .material-symbols-outlined { color: #6F6F6F; }
 /* === Error === */
 .login-error {
 display: flex;
 align-items: center;
 gap: 0.5rem;
 padding: 0.625rem 0.875rem;
 border-radius: 0.625rem;
 font-size: 0.8125rem;
 font-weight: 500;
 }
 body.theme-light .login-error {
 background: #FEE2E2;
 border: 1px solid #FCA5A5;
 color: #B91C1C;
 }
 body.theme-dark .login-error {
 background: #2D1A1A;
 border: 1px solid #5C2B2B;
 color: #FCA5A5;
 }
 .login-error-icon { font-size: 1rem !important; flex-shrink: 0; }

 /* === Footer Hint === */
 .login-footer-hint {
 text-align: center;
 font-size: 0.75rem;
 margin-top: 1.25rem;
 margin-bottom: 0;
 line-height: 1.5;
 }
 body.theme-light .login-footer-hint { color: #9CA3AF; }
 body.theme-dark .login-footer-hint { color: #6F6F6F; }
 .login-show-password-btn,
 .login-show-password-btn:hover {
 transform: none !important;
 }
 .login-show-password-btn:hover {
 opacity: 1 !important;
 background: none !important;
 }
 .login-input {
 border-radius: var(--app-input-radius, 16px) !important;
 }
 `}</style>
    </div>
  );
};

export default memo(LoginPage);
