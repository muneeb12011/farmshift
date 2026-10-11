'use client';

import Link from 'next/link';
import { Satellite } from 'lucide-react';

export default function Footer() {
  return (
    <footer
      className="border-t"
      style={{
        background: 'var(--color-bg-secondary)',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <div className="max-w-[1280px] mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <Satellite size={20} style={{ color: '#063D91' }} />
              <span className="text-lg font-bold">
                Farm<span style={{ color: '#063D91' }}>Shift</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#9BAAA5' }}>
              Data-informed agricultural decision support.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#6B7F79' }}>
              Platform
            </h4>
            <div className="space-y-2">
              {[
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'Farm Analysis', href: '/farm-setup' },
                { label: 'Scenarios', href: '/scenarios' },
                { label: 'About', href: '/about' },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block text-sm no-underline transition-colors"
                  style={{ color: '#9BAAA5' }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Data Sources */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#6B7F79' }}>
              Data Sources
            </h4>
            <div className="space-y-2 text-sm" style={{ color: '#9BAAA5' }}>
              <p>NASA Earthdata</p>
              <p>NASA POWER</p>
              <p>NASA Harvest</p>
              <p>SMAP, MODIS, GPM</p>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#6B7F79' }}>
              Legal
            </h4>
            <div className="space-y-2">
              <Link
                href="/privacy"
                className="block text-sm no-underline transition-colors"
                style={{ color: '#9BAAA5' }}
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="block text-sm no-underline transition-colors"
                style={{ color: '#9BAAA5' }}
              >
                Terms and Conditions
              </Link>
            </div>
            <p className="text-sm leading-relaxed mt-4" style={{ color: '#9BAAA5' }}>
              NASA Space Apps Challenge 2026
              <br />
              <em>&quot;Field Shift &mdash; Adapting Farms with NASA Data&quot;</em>
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <div
          className="mt-10 pt-6 text-center"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-xs leading-relaxed max-w-2xl mx-auto" style={{ color: '#6B7F79' }}>
            FarmShift is a decision-support prototype. Insights and scenario comparisons are intended to
            support, not replace, farmer knowledge or professional agricultural advice.
            Environmental data powered by NASA Earth observations.
          </p>
          <p className="text-xs mt-3" style={{ color: '#6B7F79' }}>
            &copy; 2026 FarmShift. Built for NASA Space Apps.
          </p>
        </div>
      </div>
    </footer>
  );
}
