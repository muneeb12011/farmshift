'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import {
  Satellite,
  Thermometer,
  Droplets,
  Leaf,
  CloudRain,
  ArrowRight,
  BarChart3,
  GitBranch,
  Brain,
  Shield,
  Globe,
  Layers,
  ChevronRight,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const envOverlays = [
  { label: 'TEMPERATURE', value: '+1.2\u00B0C', icon: Thermometer, color: '#E7B75B' },
  { label: 'SOIL MOISTURE', value: '68%', icon: Droplets, color: '#4EC4B1' },
  { label: 'VEGETATION', value: '0.61 NDVI', icon: Leaf, color: '#65C18C' },
  { label: 'RAINFALL', value: '-12%', icon: CloudRain, color: '#063D91' },
];

const howItWorks = [
  {
    step: '01',
    title: 'Select Your Field',
    description: 'Click on the map or search for your farm location. Draw field boundaries for precise analysis.',
    icon: Globe,
  },
  {
    step: '02',
    title: 'Review Environment',
    description: 'Explore NASA Earth observation data: temperature trends, rainfall, soil moisture, and vegetation health.',
    icon: Satellite,
  },
  {
    step: '03',
    title: 'Set Priorities',
    description: 'Tell FarmShift what matters most: water conservation, soil health, yield stability, or climate resilience.',
    icon: Layers,
  },
  {
    step: '04',
    title: 'Compare Scenarios',
    description: 'Review crop-rotation scenarios side by side. Understand trade-offs with data-backed explanations.',
    icon: BarChart3,
  },
];

const nasaDatasets = [
  { name: 'NASA POWER', desc: 'Climate observations and growing conditions', color: '#063D91' },
  { name: 'SMAP', desc: 'Soil moisture and water availability', color: '#4EC4B1' },
  { name: 'MODIS / HLS', desc: 'Vegetation health and crop monitoring', color: '#65C18C' },
  { name: 'ECOSTRESS', desc: 'Evapotranspiration and water stress', color: '#E7B75B' },
  { name: 'GPM IMERG', desc: 'Precipitation and rainfall patterns', color: '#063D91' },
  { name: 'Landsat', desc: 'Land surface temperature and change detection', color: '#E06C5A' },
];

function ParallaxImage({
  src,
  alt,
  className,
  speed = 0.3,
}: {
  src: string;
  alt: string;
  className?: string;
  speed?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, -80 * speed]);

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      <Image src={src} alt={alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
    </motion.div>
  );
}

export default function LandingPage() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroImageY = useTransform(heroScroll, [0, 1], [0, 120]);
  const heroOpacity = useTransform(heroScroll, [0, 0.6], [1, 0]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      <Navbar />

      {/* ============ HERO ============ */}
      <section ref={heroRef} className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        {/* Parallax background image */}
        <motion.div className="absolute inset-0 z-0" style={{ y: heroImageY }}>
          <Image
            src="/hero-satellite-farm.jpg"
            alt="Aerial view of agricultural farmland with geometric crop patterns"
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgba(7,16,20,0.72) 0%, rgba(7,16,20,0.82) 50%, rgba(7,16,20,0.97) 100%)',
            }}
          />
        </motion.div>

        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 z-0 opacity-[0.06]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(6,61,145,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(6,61,145,0.3) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />

        <motion.div style={{ opacity: heroOpacity }} className="relative z-10 max-w-[1280px] mx-auto px-6 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text content */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex items-center gap-2 mb-6"
              >
                <Image src="/nasalogo.png" alt="NASA" width={28} height={28} />
                <span
                  className="text-xs font-mono uppercase tracking-widest px-3 py-1"
                  style={{
                    color: '#9BAAA5',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  NASA Space Apps 2026
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6"
                style={{ letterSpacing: '-0.03em' }}
              >
                Understand Your Field.
                <br />
                <span style={{ color: '#063D91' }}>Adapt With Data.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="text-lg mb-8 max-w-lg leading-relaxed"
                style={{ color: '#9BAAA5' }}
              >
                FarmShift transforms NASA Earth observations, local farm information, and crop
                characteristics into clear environmental insights and crop-rotation scenarios.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3 }}
                className="flex flex-wrap gap-3"
              >
                <Link href="/dashboard" className="btn-primary text-base no-underline">
                  Explore Your Farm
                  <ArrowRight size={18} />
                </Link>
                <a href="#how-it-works" className="btn-secondary text-base no-underline">
                  See How It Works
                </a>
              </motion.div>
            </div>

            {/* Right: Environmental data overlays */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="hidden lg:grid grid-cols-2 gap-3"
            >
              {envOverlays.map((overlay, i) => (
                <motion.div
                  key={overlay.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                  className="card p-5 group"
                  style={{ animation: `float ${4 + i * 0.5}s ease-in-out infinite` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <overlay.icon size={14} style={{ color: overlay.color }} />
                    <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#6B7F79' }}>
                      {overlay.label}
                    </span>
                  </div>
                  <p className="text-2xl font-bold font-mono" style={{ color: overlay.color }}>
                    {overlay.value}
                  </p>
                  <p className="text-[10px] mt-1 font-mono" style={{ color: '#6B7F79' }}>
                    Demo value
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          >
            <span className="text-xs" style={{ color: '#6B7F79' }}>
              Scroll to explore
            </span>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-5 h-8 flex items-start justify-center pt-1"
              style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: 'var(--radius-lg)' }}
            >
              <div className="w-1 h-2 rounded-full" style={{ background: '#063D91' }} />
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ============ PROBLEM with IMAGE ============ */}
      <section className="section">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
        >
          <div>
            <motion.span
              custom={0}
              variants={fadeUp}
              className="text-xs font-mono uppercase tracking-widest"
              style={{ color: '#063D91' }}
            >
              The Challenge
            </motion.span>
            <motion.h2 custom={1} variants={fadeUp} className="section-title mt-3">
              Climate Change Is Reshaping Agriculture
            </motion.h2>
            <motion.p custom={2} variants={fadeUp} className="section-subtitle mx-auto mt-4">
              Shifting weather patterns, unpredictable rainfall, and rising temperatures are making traditional
              farming approaches less reliable. Farmers need data-driven insights to adapt their crop rotations
              and protect their livelihoods.
            </motion.p>
          </div>

          <motion.div custom={3} variants={fadeUp} className="relative aspect-[4/3] rounded-2xl overflow-hidden">
            <ParallaxImage
              src="/wheat-field.jpg"
              alt="Golden wheat field at sunset showing the agricultural landscape impacted by climate change"
              className="absolute inset-0"
              speed={0.2}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, rgba(7,16,20,0.5) 0%, transparent 60%)' }}
            />
          </motion.div>
        </motion.div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how-it-works" className="section">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="mb-12"
        >
          <motion.span
            custom={0}
            variants={fadeUp}
            className="text-xs font-mono uppercase tracking-widest"
            style={{ color: '#063D91' }}
          >
            How FarmShift Works
          </motion.span>
          <motion.h2 custom={1} variants={fadeUp} className="section-title mt-3">
            From Observation to Decision
          </motion.h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {howItWorks.map((step, i) => (
            <motion.div
              key={step.step}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={i}
              variants={fadeUp}
              className="card p-6 group relative overflow-hidden"
            >
              {/* Top accent line */}
              <motion.div
                className="absolute top-0 left-0 h-[2px]"
                style={{ background: '#063D91' }}
                initial={{ width: 0 }}
                whileInView={{ width: '100%' }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.15 }}
              />
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl font-bold font-mono" style={{ color: 'rgba(6, 61, 145, 0.3)' }}>
                  {step.step}
                </span>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                  style={{ background: 'rgba(6, 61, 145, 0.1)' }}
                >
                  <step.icon size={20} style={{ color: '#063D91' }} />
                </div>
              </div>
              <h3 className="text-base font-semibold mb-2" style={{ color: '#F5F7F2' }}>
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: '#9BAAA5' }}>
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ============ VISUAL SHOWCASE ============ */}
      <section className="section">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center"
        >
          <motion.div custom={0} variants={fadeUp} className="relative aspect-[3/4] rounded-2xl overflow-hidden">
            <ParallaxImage
              src="/farm-terraces.jpg"
              alt="Terraced agricultural fields showing water management and erosion control"
              className="absolute inset-0"
              speed={0.25}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, rgba(7,16,20,0.6) 0%, transparent 50%)' }}
            />
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <span className="data-badge-green mb-2 inline-block">Terraced Agriculture</span>
              <p className="text-sm mt-2" style={{ color: '#9BAAA5' }}>
                Terrain-adapted farming practices that improve water retention and reduce soil erosion.
              </p>
            </div>
          </motion.div>

          <div className="space-y-6">
            <motion.div custom={1} variants={fadeUp}>
              <span className="text-xs font-mono uppercase tracking-widest" style={{ color: '#063D91' }}>
                Why It Matters
              </span>
              <h2 className="section-title mt-3">
                Every Field Tells a Story in Data
              </h2>
              <p className="section-subtitle mt-3">
                NASA satellites collect environmental data across the planet every day. FarmShift
                makes that data accessible and actionable for farmers making real decisions about
                what to plant and when.
              </p>
            </motion.div>

            <motion.div
              custom={2}
              variants={fadeUp}
              className="relative aspect-[4/3] rounded-2xl overflow-hidden"
            >
              <ParallaxImage
                src="/soil-seedlings.jpg"
                alt="Healthy soil with young crop seedlings emerging in morning light"
                className="absolute inset-0"
                speed={0.15}
              />
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(7,16,20,0.5) 0%, transparent 50%)' }}
              />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <span className="data-badge mb-2 inline-block">Soil Health</span>
                <p className="text-sm mt-2" style={{ color: '#9BAAA5' }}>
                  Healthy soil structure is the foundation of sustainable crop rotation.
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ============ NASA DATA ============ */}
      <section
        className="section"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(6, 61, 145, 0.03), transparent)' }}
      >
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="mb-12"
        >
          <motion.span
            custom={0}
            variants={fadeUp}
            className="text-xs font-mono uppercase tracking-widest"
            style={{ color: '#063D91' }}
          >
            Powered by NASA
          </motion.span>
          <motion.h2 custom={1} variants={fadeUp} className="section-title mt-3">
            Earth Observation Datasets
          </motion.h2>
          <motion.p custom={2} variants={fadeUp} className="section-subtitle mt-3">
            FarmShift leverages multiple NASA Earth observation datasets to provide comprehensive
            environmental intelligence.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {nasaDatasets.map((ds) => (
            <motion.div
              key={ds.name}
              variants={fadeUp}
              custom={0}
              className="card p-5 group flex items-start gap-4"
            >
              <div
                className="w-2 h-full min-h-[40px] rounded-full shrink-0 transition-all duration-300 group-hover:w-3"
                style={{ background: ds.color }}
              />
              <div>
                <h4 className="text-sm font-semibold mb-1" style={{ color: '#F5F7F2' }}>
                  {ds.name}
                </h4>
                <p className="text-xs" style={{ color: '#9BAAA5' }}>
                  {ds.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="section">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="mb-12"
        >
          <motion.span
            custom={0}
            variants={fadeUp}
            className="text-xs font-mono uppercase tracking-widest"
            style={{ color: '#063D91' }}
          >
            Key Features
          </motion.span>
          <motion.h2 custom={1} variants={fadeUp} className="section-title mt-3">
            Intelligence at Every Level
          </motion.h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: GitBranch,
              title: 'Crop Rotation Scenarios',
              description:
                'Explore multiple rotation strategies with estimated environmental and agronomic metrics. Compare trade-offs at a glance.',
            },
            {
              icon: BarChart3,
              title: 'Scenario Comparison',
              description:
                'Side-by-side comparison of water demand, soil health, climate compatibility, and more. Data-driven decision support.',
            },
            {
              icon: Brain,
              title: 'AI-Powered Explanations',
              description:
                'Plain-language explanations of scenario differences, trade-offs, and environmental context. Transparent and understandable.',
            },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={i}
              variants={fadeUp}
              className="card p-6 group relative overflow-hidden"
            >
              {/* Animated accent */}
              <motion.div
                className="absolute bottom-0 left-0 h-[2px]"
                style={{ background: '#063D91' }}
                initial={{ width: 0 }}
                whileInView={{ width: '40%' }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }}
              />
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                style={{ background: 'rgba(6, 61, 145, 0.12)' }}
              >
                <feature.icon size={22} style={{ color: '#063D91' }} />
              </div>
              <h3 className="text-base font-semibold mb-2" style={{ color: '#F5F7F2' }}>
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: '#9BAAA5' }}>
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ============ TRANSPARENCY ============ */}
      <section className="section">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="card p-8 md:p-10"
          style={{ background: 'rgba(6, 61, 145, 0.05)', borderColor: 'rgba(6, 61, 145, 0.15)' }}
        >
          <div className="flex items-center gap-3 mb-6">
            <Shield size={22} style={{ color: '#063D91' }} />
            <h3 className="text-lg font-semibold" style={{ color: '#F5F7F2' }}>
              About These Insights
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Observed Data', detail: 'NASA Earth observations', icon: Satellite },
              { label: 'User Data', detail: 'Soil and farm information', icon: Layers },
              { label: 'Derived Indicators', detail: 'Calculated environmental metrics', icon: BarChart3 },
              { label: 'AI Explanation', detail: 'Natural-language interpretation', icon: Brain },
            ].map((item, i) => (
              <motion.div key={item.label} custom={i} variants={fadeUp}>
                <div className="flex items-center gap-2 mb-2">
                  <item.icon size={14} style={{ color: '#4EC4B1' }} />
                  <span className="text-sm font-semibold" style={{ color: '#F5F7F2' }}>
                    {item.label}
                  </span>
                </div>
                <p className="text-xs" style={{ color: '#9BAAA5' }}>
                  {item.detail}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ============ CTA ============ */}
      <section className="section text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
        >
          <motion.h2 custom={0} variants={fadeUp} className="section-title">
            Ready to Explore Your Farm?
          </motion.h2>
          <motion.p custom={1} variants={fadeUp} className="section-subtitle mx-auto mt-3 text-center">
            Start with a demo field or select your own location. FarmShift provides data-driven
            environmental insights and crop-rotation scenario analysis.
          </motion.p>
          <motion.div custom={2} variants={fadeUp} className="mt-8 flex justify-center gap-4">
            <Link href="/dashboard" className="btn-primary text-base no-underline">
              Launch Dashboard
              <ChevronRight size={18} />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
