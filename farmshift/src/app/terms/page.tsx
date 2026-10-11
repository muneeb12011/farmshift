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

export default function TermsPage() {
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
              Terms and Conditions
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
                  1. Acceptance of Terms
                </h2>
                <p>
                  By accessing and using FarmShift, you agree to be bound by these Terms and
                  Conditions. If you do not agree with any part of these terms, you should not
                  use this platform.
                </p>
              </div>

              <div>
                <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7F2' }}>
                  2. Prototype Status
                </h2>
                <p>
                  FarmShift is a hackathon prototype developed for the NASA International
                  Space Apps Challenge 2026. It is provided on an &quot;as is&quot; and &quot;as
                  available&quot; basis. All environmental data shown in the current version is
                  simulated for demonstration purposes. No live NASA API connections are active.
                </p>
              </div>

              <div>
                <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7F2' }}>
                  3. Not Agricultural Advice
                </h2>
                <p>
                  FarmShift is a decision-support tool, not an agricultural advisory service.
                  The platform provides data-driven environmental insights and crop-rotation
                  scenario comparisons intended to support informed decision-making. It does
                  not replace professional agricultural advice, local extension services, or
                  farmer knowledge and experience. Users should not rely solely on FarmShift
                  output for planting, irrigation, or crop management decisions.
                </p>
              </div>

              <div>
                <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7F2' }}>
                  4. Data Accuracy
                </h2>
                <p>
                  Environmental metrics, scenario comparisons, and AI-generated explanations
                  are derived from available inputs and are relative estimates. Accuracy depends
                  on satellite data quality, temporal coverage, and local conditions. FarmShift
                  clearly communicates data provenance and confidence levels where possible.
                  Users acknowledge that real-world outcomes may differ from projected scenarios.
                </p>
              </div>

              <div>
                <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7F2' }}>
                  5. NASA Data Attribution
                </h2>
                <p>
                  FarmShift references publicly available NASA Earth observation datasets
                  including NASA POWER, SMAP, MODIS, ECOSTRESS, GPM IMERG, and Landsat. NASA
                  data is provided freely and openly by the National Aeronautics and Space
                  Administration. Use of NASA data does not imply NASA endorsement of FarmShift
                  or its outputs.
                </p>
              </div>

              <div>
                <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7F2' }}>
                  6. Intellectual Property
                </h2>
                <p>
                  The FarmShift platform, including its design, code, and documentation, was
                  created for the NASA Space Apps Challenge 2026. The project is open-source
                  under the terms specified in the project repository. NASA logos and branding
                  are used in accordance with NASA media usage guidelines for Space Apps
                  Challenge participants.
                </p>
              </div>

              <div>
                <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7F2' }}>
                  7. Limitation of Liability
                </h2>
                <p>
                  To the fullest extent permitted by law, the FarmShift team shall not be liable
                  for any direct, indirect, incidental, consequential, or special damages arising
                  from the use of or inability to use the platform, including but not limited to
                  crop losses, financial losses, or damages resulting from reliance on platform
                  outputs.
                </p>
              </div>

              <div>
                <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7F2' }}>
                  8. User Responsibilities
                </h2>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    Users are responsible for verifying the accuracy and applicability of any
                    insights provided by FarmShift to their specific agricultural context.
                  </li>
                  <li>
                    Users should consult with local agricultural experts before making significant
                    changes to farming practices based on any decision-support tool.
                  </li>
                  <li>
                    Users agree not to misrepresent FarmShift output as certified professional
                    agricultural advice.
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7F2' }}>
                  9. Modifications
                </h2>
                <p>
                  These Terms and Conditions may be updated as the project develops. Changes
                  will be reflected on this page with an updated revision date. Continued use
                  of FarmShift after changes constitutes acceptance of the revised terms.
                </p>
              </div>

              <div>
                <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7F2' }}>
                  10. Contact
                </h2>
                <p>
                  For questions about these Terms, please reach out through the NASA Space Apps
                  Challenge project page or open an issue on the project repository.
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
