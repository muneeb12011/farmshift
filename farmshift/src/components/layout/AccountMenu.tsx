'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { LogIn, LogOut, Bookmark } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

/** Sign-in link, or "My Plans" + sign-out when signed in. Renders nothing until the session is known. */
export default function AccountMenu({ mobile = false }: { mobile?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const signOut = useAuthStore((s) => s.signOut);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) return null;

  const linkClass = mobile
    ? 'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium no-underline transition-all'
    : 'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium no-underline transition-all duration-200';
  const linkStyle = mobile ? { color: '#9BAAA5' } : { color: '#9BAAA5', border: '1px solid rgba(255,255,255,0.08)' };

  if (!user) {
    return (
      <Link href="/login" className={linkClass} style={linkStyle}>
        <LogIn size={mobile ? 18 : 15} />
        Sign in
      </Link>
    );
  }
  return (
    <>
      <Link href="/plans" className={linkClass} style={linkStyle}>
        <Bookmark size={mobile ? 18 : 15} />
        My Plans
      </Link>
      <button
        onClick={() => void signOut()}
        className={linkClass}
        style={{ ...linkStyle, background: 'transparent', cursor: 'pointer' }}
        title={`Signed in as ${user.email}`}
      >
        <LogOut size={mobile ? 18 : 15} />
        Sign out
      </button>
    </>
  );
}
