'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import {
  Satellite,
  Globe,
  Database,
  Brain,
  Shield,
  BarChart3,
  Layers,
  ExternalLink,
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1 },
  }),
};

const datasets = [
  {
    name: 'NASA POWER',
    fullName: 'Prediction of Worldwide Energy Resource',
    desc: 'Climate observations including temperature, humidity, wind speed, and solar radiation. Provides daily and monthly climatological data.',
    url: 'https://power.larc.nasa.gov/',
    cadence: 'Daily / Monthly',
  },
  {
    name: 'SMAP L4',
    fullName: 'Soil Moisture Active Passive',
    desc: 'Global soil moisture measurements at the surface and root zone. Critical for understanding water availability and irrigation needs.',
    url: 'https://smap.jpl.nasa.gov/',
    cadence: '3-hourly / Daily',
  },
  {
    name: 'MODIS / HLS',
    fullName: 'Moderate Resolution Imaging Spectroradiometer',
    desc: 'Vegetation indices (NDVI, EVI) for monitoring crop health and growing season dynamics. Harmonized Landsat Sentinel data for higher resolution.',
    url: 'https://modis.gsfc.nasa.gov/',
    cadence: '8-day / 16-day composite',
  },
  {
    name: 'ECOSTRESS',
    fullName: 'ECOsystem Spaceborne Thermal Radiometer on Space Station',
    desc: 'Evapotranspiration and water stress measurements. Identifies areas of plant water stress before visible wilting.',
    url: 'https://ecostress.jpl.nasa.gov/',
    cadence: 'Variable (ISS orbit)',
  },
  {
    name: 'GPM IMERG',
    fullName: 'Global Precipitation Measurement',
    desc: 'High-resolution precipitation estimates combining satellite and rain gauge data. Enables rainfall pattern analysis and drought monitoring.',
    url: 'https://gpm.nasa.gov/',
    cadence: '30-min / Daily / Monthly',
  },
  {
    name: 'Landsat',
    fullName: 'Landsat Collection 2',
    desc: 'Multi-spectral land surface observations for temperature, land cover change, and crop classification. The longest continuous satellite record.',
    url: 'https://landsat.gsfc.nasa.gov/',
    cadence: '16-day revisit',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      <Navbar />

      <main className="pt-20 pb-12">
        {/* Hero */}
        <section className="section">
          <motion.div
            initial="hidden"
            animate="visible"
            className="max-w-3xl"
          >
            <motion.div custom={0} variants={fadeUp} className="flex items-center gap-3 mb-4">
              <Image src="/nasalogo.png" alt="NASA" width={32} height={32} />
              <span
                className="text-xs font-mono uppercase tracking-widest px-3 py-1 rounded-full"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#9BAAA5' }}
              >
                NASA Space Apps Challenge 2026
              </span>
            </motion.div>

            <motion.h1 custom={1} variants={fadeUp} className="text-3xl sm:text-4xl font-bold mb-4" style={{ letterSpacing: '-0.02em' }}>
              About FarmShift
            </motion.h1>

            <motion.p custom={2} variants={fadeUp} className="text-lg leading-relaxed" style={{ color: '#9BAAA5' }}>
              FarmShift is a decision-support platform built for the NASA International Space Apps
              Challenge 2026 track: <em>&quot;Field Shift: Adapting Farms with NASA Data.&quot;</em> It
              transforms NASA Earth observation data into actionable agricultural insights and
              crop-rotation scenarios.
            </motion.p>
          </motion.div>

          {/* Animated NASA Satellite Visual */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-10 rounded-2xl overflow-hidden card relative shadow-2xl"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="relative w-full h-[280px] sm:h-[380px] overflow-hidden">
              <div className="w-full h-full relative animate-ken-burns">
                <Image
                  src="/nasa-satellite-orbit.jpg"
                  alt="NASA Earth observation satellite observing planetary agricultural biomes"
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 1200px) 100vw, 1200px"
                />
              </div>

              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(to top, rgba(7, 16, 20, 0.95) 0%, rgba(7, 16, 20, 0.2) 60%, transparent 100%)',
                }}
              />

              <div className="absolute bottom-5 left-5 right-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400">
                      Active Earth Observation Stream
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white leading-tight">
                    Low Earth Orbit Agro-Constellation
                  </h3>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: '#9BAAA5' }}>
                    Orbital multispectral &amp; microwave radiometry capturing continuous surface reflectance, soil moisture dynamics, and canopy transpiration across 6 continents.
                  </p>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-mono" style={{ color: '#6B7F79' }}>
                  <span className="px-2.5 py-1 rounded bg-black/50 border border-white/10 text-white">
                    ALT: 705 KM
                  </span>
                  <span className="px-2.5 py-1 rounded bg-black/50 border border-white/10 text-white">
                    INC: 98.2 SUN-SYNC
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Mission */}
        <section className="section">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
          >
            <motion.h2 custom={0} variants={fadeUp} className="section-title mb-8">
              Our Approach
            </motion.h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: Satellite,
                  title: 'NASA Earth Observations',
                  desc: 'We leverage multiple NASA datasets (SMAP, MODIS, GPM, ECOSTRESS, NASA POWER, and Landsat) to build a comprehensive environmental picture of any agricultural field.',
                },
                {
                  icon: Layers,
                  title: 'Decision Support, Not Dictation',
                  desc: 'FarmShift presents data, scenarios, and trade-offs transparently. We never claim guaranteed recommendations. Farmers retain full decision-making authority.',
                },
                {
                  icon: Brain,
                  title: 'Explainable Insights',
                  desc: 'Every insight links back to its data source. AI explanations are designed to be understandable, not opaque. Technical detail is discoverable, not forced.',
                },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  custom={i + 1}
                  variants={fadeUp}
                  className="card p-6"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                    style={{ background: 'rgba(6, 61, 145, 0.12)' }}
                  >
                    <item.icon size={20} style={{ color: '#063D91' }} />
                  </div>
                  <h3 className="text-base font-semibold mb-2" style={{ color: '#F5F7F2' }}>
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#9BAAA5' }}>
                    {item.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Data & Methodology */}
        <section className="section">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
          >
            <motion.span
              custom={0}
              variants={fadeUp}
              className="text-xs font-mono uppercase tracking-widest"
              style={{ color: '#063D91' }}
            >
              Data & Methodology
            </motion.span>
            <motion.h2 custom={1} variants={fadeUp} className="section-title mt-3 mb-3">
              NASA Datasets Used
            </motion.h2>
            <motion.p custom={2} variants={fadeUp} className="section-subtitle mb-8">
              Every metric in FarmShift traces back to a specific NASA dataset. This is a prototype; current data is simulated for demonstration purposes.
            </motion.p>

            <div className="space-y-4">
              {datasets.map((ds, i) => (
                <motion.div
                  key={ds.name}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  custom={i}
                  variants={fadeUp}
                  className="card p-5 flex flex-col sm:flex-row sm:items-start gap-4"
                >
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 text-xs font-mono font-bold"
                    style={{ background: 'rgba(6, 61, 145, 0.12)', color: '#063D91' }}
                  >
                    <Database size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-base font-semibold" style={{ color: '#F5F7F2' }}>
                        {ds.name}
                      </h3>
                      <span className="text-[10px] font-mono" style={{ color: '#6B7F79' }}>
                        {ds.fullName}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed mb-2" style={{ color: '#9BAAA5' }}>
                      {ds.desc}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="data-badge">Cadence: {ds.cadence}</span>

                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Transparency */}
        <section className="section">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="card p-8"
            style={{ background: 'rgba(6, 61, 145, 0.03)', borderColor: 'rgba(6, 61, 145, 0.1)' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <Shield size={22} style={{ color: '#063D91' }} />
              <h3 className="text-lg font-semibold" style={{ color: '#F5F7F2' }}>
                Transparency & Limitations
              </h3>
            </div>
            <div className="space-y-4 text-sm leading-relaxed" style={{ color: '#9BAAA5' }}>
              <p>
                <strong style={{ color: '#F5F7F2' }}>Prototype Status:</strong> FarmShift is a
                hackathon prototype. All environmental data shown is simulated for demonstration
                purposes. No live NASA API connections are active in this version.
              </p>
              <p>
                <strong style={{ color: '#F5F7F2' }}>Not Agricultural Advice:</strong> Scenario
                comparisons are relative estimates based on available inputs. They are intended to
                support informed decision-making, not replace professional agricultural advice or
                local farmer expertise.
              </p>
              <p>
                <strong style={{ color: '#F5F7F2' }}>Data Confidence:</strong> Real-world accuracy
                depends on satellite data quality, temporal coverage, and local conditions. The
                platform is designed to clearly communicate data provenance and confidence levels.
              </p>
            </div>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
