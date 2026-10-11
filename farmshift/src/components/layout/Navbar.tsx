'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AccountMenu from './AccountMenu';
import {
  LayoutDashboard,
  Sprout,
  GitBranch,
  BarChart3,
  Info,
  Database,
  User,
  Menu,
  X,
  Satellite,
} from 'lucide-react';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/farm-setup', label: 'Farm Analysis', icon: Sprout },
  { href: '/rotation-builder', label: 'Rotation Builder', icon: GitBranch },
  { href: '/scenarios', label: 'Scenarios', icon: BarChart3 },
  { href: '/about', label: 'About', icon: Info },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <nav
        className="border-b"
        style={{
          background: 'rgba(7, 16, 20, 0.85)',
          backdropFilter: 'blur(16px)',
          borderColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <div className="max-w-[1440px] mx-auto px-4 md:px-6 flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 no-underline group">
            <div className="relative w-9 h-9 flex items-center justify-center">
              <Image src="/nasalogo.png" alt="NASA Logo" width={36} height={36} className="object-contain" />
            </div>
            <span className="text-lg font-bold tracking-tight" style={{ color: '#F5F7F2' }}>
              Farm<span style={{ color: '#063D91' }}>Shift</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 no-underline"
                  style={{
                    color: isActive ? '#F5F7F2' : '#9BAAA5',
                    background: isActive ? 'rgba(6, 61, 145, 0.15)' : 'transparent',
                  }}
                >
                  <Icon size={16} />
                  {link.label}
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                      style={{ background: '#063D91' }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/farm-setup"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium no-underline transition-all duration-200"
              style={{
                color: '#9BAAA5',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <User size={15} />
              Farm Profile
            </Link>
            <AccountMenu />
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg transition-colors"
            style={{ color: '#F5F7F2' }}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden overflow-hidden"
              style={{
                background: 'rgba(7, 16, 20, 0.98)',
                borderTop: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="p-4 space-y-1">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href;
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium no-underline transition-all"
                      style={{
                        color: isActive ? '#F5F7F2' : '#9BAAA5',
                        background: isActive ? 'rgba(6, 61, 145, 0.15)' : 'transparent',
                      }}
                    >
                      <Icon size={18} />
                      {link.label}
                    </Link>
                  );
                })}
                <AccountMenu mobile />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}
