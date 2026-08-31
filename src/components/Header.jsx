import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bike, Store, Menu, X, LayoutDashboard, Tag, LogOut, Repeat, ShoppingCart, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { MotoluvLogo } from './MotoluvLogo';
import NotificationBell from './NotificationBell';

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { user, logout, activeView, setActiveView } = useAuth();
  const { cartCount, setIsCartOpen } = useCart();

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isActive = (p) => location.pathname === p || (p !== '/' && location.pathname.startsWith(p));

  const navItems = [
    { to: '/como-funciona', label: 'Cómo Funciona' },
    { to: '/motos', label: 'Motocicletas' },
    { to: '/tienda', label: 'Tienda', icon: Store },
  ];

  const doLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate('/');
  };

  const toggleProfileView = () => {
    const nextView = activeView === 'vendedor' ? 'comprador' : 'vendedor';
    setActiveView(nextView);
    setDropdownOpen(false);
    if (nextView === 'comprador') navigate('/panel/mis-ofertas');
    else navigate('/panel');
  };

  const firstName = user?.name?.split(' ')[0] || 'Usuario';
  const initials = (user?.name || 'U').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0a]/85 backdrop-blur border-b border-black">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center group" title="Motoluv">
          <div className="relative flex items-center justify-center py-1 px-2 rounded bg-black/60 border border-black group-hover:border-[#E10600]/60 transition-colors">
            <MotoluvLogo className="h-7 md:h-8 w-auto" />
          </div>
        </Link>

        {/* Center Nav */}
        <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-2 text-sm transition-colors ${
                isActive(to) ? 'text-red-brand' : 'text-zinc-300 hover:text-red-brand'
              }`}
            >
              {Icon && <Icon size={16} />}
              {label}
            </Link>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 rounded-full border border-white/10 hover:border-red-brand/50 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Ver carrito de compra"
          >
            <ShoppingCart size={18} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-brand text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center font-mono">
                {cartCount}
              </span>
            )}
          </button>

          {user && (
            <NotificationBell />
          )}

          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2.5 pr-2 pl-1 py-1 rounded-full border border-white/10 hover:border-red-brand/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-red-brand/20 border border-red-brand/40 flex items-center justify-center text-red-brand text-xs font-bold">
                  {initials}
                </div>
                <span className="text-sm text-white pr-2">{firstName}</span>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-[#111112] border border-white/10 rounded-md shadow-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 bg-[#0a0a0a]">
                    <div className="text-white text-sm font-medium">{user.name}</div>
                    <div className="text-zinc-500 text-xs truncate">{user.email}</div>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-brand/10 border border-red-brand/30 text-red-brand">
                      {activeView === 'vendedor' ? 'Perfil Vendedor' : 'Perfil Comprador'}
                    </div>
                  </div>
                  <div className="py-2">
                    <DropdownLink to="/panel/perfil" icon={User} label="Mi Perfil" onClick={() => setDropdownOpen(false)} />
                    <DropdownLink to="/panel" icon={LayoutDashboard} label="Panel de Vendedor" onClick={() => { setActiveView('vendedor'); setDropdownOpen(false); }} />
                    <DropdownLink to="/panel/mis-ofertas" icon={Tag} label="Mis Ofertas (Comprador)" onClick={() => { setActiveView('comprador'); setDropdownOpen(false); }} />
                    <DropdownLink to="/panel/mis-motos" icon={Bike} label="Mis Publicaciones" onClick={() => { setActiveView('vendedor'); setDropdownOpen(false); }} />
                  </div>
                  <div className="border-t border-white/5 py-2">
                    <button onClick={toggleProfileView} className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold tracking-wider uppercase text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">
                      <Repeat size={14} className="text-red-brand" /> {activeView === 'vendedor' ? 'Cambiar a Vista Comprador' : 'Cambiar a Vista Vendedor'}
                    </button>
                    <button onClick={doLogout} className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold tracking-wider uppercase text-red-brand hover:bg-white/5 transition-colors">
                      <LogOut size={14} /> Cerrar Sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/iniciar-sesion" className="text-sm text-zinc-300 hover:text-red-brand transition-colors">
                Iniciar Sesión
              </Link>
              <button
                onClick={() => navigate('/registro')}
                className="btn-red px-5 py-2.5 text-xs font-bold tracking-widest uppercase rounded-sm"
              >
                Registrarse
              </button>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-white" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-[#0a0a0a] border-t border-white/5 px-5 py-4 space-y-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} onClick={() => setOpen(false)} className="flex items-center gap-2 text-zinc-300 hover:text-red-brand">
              {Icon && <Icon size={16} />} {label}
            </Link>
          ))}
          <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
            {user ? (
              <>
                <Link to="/panel/perfil" onClick={() => setOpen(false)} className="flex items-center gap-2 text-zinc-300 hover:text-white"><User size={16} className="text-red-brand" /> Mi Perfil</Link>
                <Link to="/panel" onClick={() => setOpen(false)} className="flex items-center gap-2 text-zinc-300 hover:text-white"><LayoutDashboard size={16} /> Panel</Link>
                <button onClick={doLogout} className="text-left text-red-brand flex items-center gap-2"><LogOut size={16} /> Cerrar Sesión</button>
              </>
            ) : (
              <>
                <Link to="/iniciar-sesion" onClick={() => setOpen(false)} className="text-zinc-300">Iniciar Sesión</Link>
                <Link to="/registro" onClick={() => setOpen(false)} className="px-4 py-2 bg-red-brand text-white text-xs font-bold uppercase text-center">Registrarse</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

const DropdownLink = ({ to, icon: Icon, label, onClick }) => (
  <Link to={to} onClick={onClick} className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
    <Icon size={14} /> {label}
  </Link>
);

export default Header;
