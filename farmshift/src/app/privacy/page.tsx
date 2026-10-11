'use client';

import { motion } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08 },
  }),
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      <Navbar />

      <main className="pt-20 pb-12">
        <section className="section max-w-3xl">
          <motion.div initial="hidden" animate="visible">
            <motion.h1
              custom={0}
              variants={fadeUp}
              className="text-3xl sm:text-4xl font-bold mb-4"
              style={{ letterSpacing: '-0.02em' }}
            >
              Privacy Policy
            </motion.h1>
            <motion.p
              custom={1}
              variants={fadeUp}
              className="text-sm font-mono mb-8"
              style={{ color: '#6B7F79' }}
            >
              Last updated: September 2026
            </motion.p>

            <motion.div
              custom={2}
              variants={fadeUp}
              className="space-y-8 text-sm leading-relaxed"
              style={{ color: '#9BAAA5' }}
            >
              <div>
                <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7F2' }}>
                  1. Overview
                </h2>
                <p>
                  FarmShift is a decision-support prototype built for the NASA International
                  Space Apps Challenge 2026. This Privacy Policy describes how FarmShift
                  collects, uses, and protects information when you use the platform.
                </p>
              </div>

              <div>
                <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7F2' }}>
                  2. Information We Collect
                </h2>
                <p className="mb-3">
                  FarmShift is a client-side application. We do not collect personal
                  information, create user accounts, or require sign-in. The following
                  information may be processed locally on your device:
                </p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    Farm location coordinates you select (latitude, longitude). These are
                    stored only in your browser session memory and are not transmitted to
                    any server.
                  </li>
                  <li>
                    Soil profile, crop, and priority preferences you configure during
                    farm setup. These remain in your browser and are cleared when you
                    close the tab.
                  </li>
                  <li>
                    Standard web analytics data such as page views and browser type, if
                    analytics are enabled in future versions.
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7F2' }}>
                  3. Data Storage
                </h2>
                <p>
                  All user-entered data (field selection, soil information, priorities) is
                  stored exclusively in your browser&apos;s local memory using client-side state
                  management. No data is sent to, or stored on, any external server. Closing
                  your browser tab clears all session data.
                </p>
              </div>

              <div>
                <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7F2' }}>
                  4. Third-Party Services
                </h2>
                <p className="mb-3">
                  FarmShift references NASA public datasets for display purposes. In the
                  current prototype, all environmental data is simulated. No live API calls
                  to NASA or any third-party service are made. Future versions may connect
                  to the following public NASA APIs:
                </p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>NASA POWER (power.larc.nasa.gov)</li>
                  <li>NASA Earthdata (earthdata.nasa.gov)</li>
                </ul>
                <p className="mt-3">
                  Map tiles may be loaded from OpenStreetMap or MapLibre tile servers, which
                  are subject to their own privacy policies.
                </p>
              </div>

              <div>
                <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7F2' }}>
                  5. Cookies
                </h2>
                <p>
                  FarmShift does not use cookies for tracking or advertising. Standard session
                  cookies may be used by the web hosting platform for technical purposes only.
                </p>
              </div>

              <div>
                <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7F2' }}>
                  6. Children&apos;s Privacy
                </h2>
                <p>
                  FarmShift does not knowingly collect information from children under the age
                  of 13. The platform is intended for use by agricultural professionals and
                  researchers.
                </p>
              </div>

              <div>
                <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7F2' }}>
                  7. Changes to This Policy
                </h2>
                <p>
                  This Privacy Policy may be updated as the project evolves. Any changes will
                  be reflected on this page with an updated revision date.
                </p>
              </div>

              <div>
                <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7F2' }}>
                  8. Contact
                </h2>
                <p>
                  For questions about this Privacy Policy, please reach out through the NASA
                  Space Apps Challenge project page or open an issue on the project repository.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
