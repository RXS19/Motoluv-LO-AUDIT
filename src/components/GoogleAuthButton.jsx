import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Logotipo oficial vectorial de Google con geometría y colores exactos (Google Identity Guidelines)
 */
export const GoogleLogoIcon = ({ className = "w-5 h-5", ...props }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    width="24"
    height="24"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

/**
 * Botón estético y moderno para inicio de sesión con Google
 */
const GoogleAuthButton = ({
  onClick,
  isLoading = false,
  disabled = false,
  text = 'Continuar con Google',
  loadingText = 'Conectando con Google...',
  variant = 'light', // 'light' (fondo blanco elegante oficial) o 'dark' (obsidiana con badge)
  className = '',
}) => {
  if (variant === 'dark') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || isLoading}
        className={`w-full relative group overflow-hidden bg-[#151518] hover:bg-[#1c1c22] active:scale-[0.99] text-zinc-100 border border-white/15 hover:border-zinc-400/40 transition-all duration-200 py-3 px-4 rounded-md text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-3 shadow-md disabled:opacity-50 disabled:pointer-events-none ${className}`}
      >
        <div className="w-6 h-6 rounded bg-white flex items-center justify-center shadow-sm flex-shrink-0">
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 text-zinc-700 animate-spin" />
          ) : (
            <GoogleLogoIcon className="w-4 h-4" />
          )}
        </div>
        <span className="font-semibold text-zinc-200 group-hover:text-white transition-colors">
          {isLoading ? loadingText : text}
        </span>
      </button>
    );
  }

  // Estilo 'light' oficial de Google Identity — alto impacto estético, pulido y legible
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`w-full relative group bg-white hover:bg-zinc-50 active:bg-zinc-100 active:scale-[0.99] text-zinc-800 border border-zinc-200/90 hover:border-zinc-300 transition-all duration-200 py-3 px-4 rounded-md text-xs md:text-sm font-semibold tracking-wide flex items-center justify-center gap-3 shadow-[0_2px_10px_rgba(0,0,0,0.18)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.28)] disabled:opacity-50 disabled:pointer-events-none ${className}`}
    >
      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
        {isLoading ? (
          <Loader2 className="w-4 h-4 text-zinc-600 animate-spin" />
        ) : (
          <GoogleLogoIcon className="w-5 h-5 transition-transform duration-200 group-hover:scale-105" />
        )}
      </div>
      <span className="text-zinc-800 font-bold group-hover:text-black transition-colors">
        {isLoading ? loadingText : text}
      </span>
    </button>
  );
};

export default GoogleAuthButton;
