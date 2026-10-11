'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { useFarmProfileStore, useFieldStore } from '@/store';
import { cropCatalog } from '@/data/mockCropCatalog';
import { demoFarms } from '@/data/mockFarms';
import CropIcon from '@/components/ui/CropIcon';
import {
  MapPin,
  Layers,
  Sprout,
  Droplets,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  Check,
} from 'lucide-react';

const steps = [
  { id: 1, label: 'Select Farm', icon: MapPin },
  { id: 2, label: 'Soil Information', icon: Layers },
  { id: 3, label: 'Current Crop', icon: Sprout },
  { id: 4, label: 'Water Availability', icon: Droplets },
  { id: 5, label: 'Farmer Priorities', icon: SlidersHorizontal },
];

const soilTypes = ['Sandy Loam', 'Clay', 'Silt', 'Loam', 'Clay Loam', 'Sandy Clay'];
const drainageOptions = ['Well-drained', 'Moderately drained', 'Poorly drained'];
const nutrientLevels = ['Low', 'Medium', 'High'];

export default function FarmSetupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const selectedField = useFieldStore((s) => s.selectedField);
  const setSelectedField = useFieldStore((s) => s.setSelectedField);
  const {
    soilProfile,
    setSoilProfile,
    currentCrop,
    setCurrentCrop,
    waterAvailability,
    setWaterAvailability,
    irrigationType,
    setIrrigationType,
    priorities,
    setPriorities,
    setSetupComplete,
  } = useFarmProfileStore();

  const handleNext = () => {
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleComplete = () => {
    setSetupComplete(true);
    router.push('/rotation-builder');
  };

  const handlePriorityChange = (key: string, value: number) => {
    setPriorities({ ...priorities, [key]: value });
  };

  const priorityLabels: Record<string, string> = {
    waterConservation: 'Water Conservation',
    soilHealth: 'Soil Health',
    yieldStability: 'Yield Stability',
    climateResilience: 'Climate Resilience',
    cropDiversity: 'Crop Diversity',
    lowerInputRequirement: 'Lower Input Requirement',
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      <Navbar />

      <main className="pt-20 pb-12 px-4 md:px-6 max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold" style={{ color: '#F5F7F2' }}>
            Farm Analysis Setup
          </h1>
          <p className="text-sm mt-1" style={{ color: '#9BAAA5' }}>
            Tell FarmShift about your field to receive tailored environmental insights.
          </p>
        </motion.div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isComplete = step.id < currentStep;
            return (
              <div key={step.id} className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentStep(step.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap"
                  style={{
                    background: isActive
                      ? 'rgba(6, 61, 145, 0.15)'
                      : isComplete
                        ? 'rgba(101, 193, 140, 0.1)'
                        : 'transparent',
                    color: isActive ? '#F5F7F2' : isComplete ? '#65C18C' : '#6B7F79',
                    border: `1px solid ${isActive ? 'rgba(6, 61, 145, 0.3)' : 'transparent'}`,
                  }}
                >
                  {isComplete ? <Check size={14} /> : <Icon size={14} />}
                  {step.label}
                </button>
                {i < steps.length - 1 && (
                  <ChevronRight size={14} style={{ color: '#6B7F79' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="card p-6 md:p-8"
          >
            {/* Step 1: Select Farm */}
            {currentStep === 1 && (
              <div>
                <h2 className="text-lg font-semibold mb-2" style={{ color: '#F5F7F2' }}>
                  Select Your Farm
                </h2>
                <p className="text-sm mb-6" style={{ color: '#9BAAA5' }}>
                  Choose a preset demonstration field or use the map on the Dashboard to select a custom location.
                </p>
                <div className="space-y-3">
                  {demoFarms.map((farm) => (
                    <button
                      key={farm.id}
                      onClick={() => setSelectedField(farm)}
                      className="w-full text-left p-4 rounded-xl flex items-center gap-4 transition-all"
                      style={{
                        background:
                          farm.id === selectedField.id
                            ? 'rgba(6, 61, 145, 0.1)'
                            : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${
                          farm.id === selectedField.id
                            ? 'rgba(6, 61, 145, 0.3)'
                            : 'rgba(255,255,255,0.06)'
                        }`,
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background:
                            farm.id === selectedField.id
                              ? 'rgba(6, 61, 145, 0.2)'
                              : 'rgba(255,255,255,0.04)',
                        }}
                      >
                        <MapPin
                          size={18}
                          style={{
                            color: farm.id === selectedField.id ? '#063D91' : '#6B7F79',
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm" style={{ color: '#F5F7F2' }}>
                          {farm.label}
                        </p>
                        <p className="text-xs font-mono mt-0.5" style={{ color: '#6B7F79' }}>
                          {farm.lat.toFixed(2)}N, {farm.lon.toFixed(2)}E - {farm.area} ha
                        </p>
                      </div>
                      {farm.id === selectedField.id && (
                        <Check size={18} style={{ color: '#063D91' }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Soil Information */}
            {currentStep === 2 && (
              <div>
                <h2 className="text-lg font-semibold mb-2" style={{ color: '#F5F7F2' }}>
                  Soil Information
                </h2>
                <p className="text-sm mb-6" style={{ color: '#9BAAA5' }}>
                  Provide soil details for your field. These help assess crop compatibility.
                </p>

                {/* Animated Soil Probe Visual */}
                <div
                  className="mb-6 rounded-2xl overflow-hidden card relative shadow-xl"
                  style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <div className="relative w-full h-[180px] sm:h-[220px] overflow-hidden">
                    <div className="w-full h-full relative animate-ken-burns">
                      <Image
                        src="/soil-sensor-telemetry.jpg"
                        alt="Calibrated agronomy in-situ soil telemetry probe and root zone moisture measurement"
                        fill
                        priority
                        className="object-cover"
                        sizes="(max-width: 1024px) 100vw, 1024px"
                      />
                    </div>
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          'linear-gradient(to top, rgba(7, 16, 20, 0.95) 0%, rgba(7, 16, 20, 0.25) 60%, transparent 100%)',
                      }}
                    />
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                          SMAP In-Situ Ground Truth
                        </span>
                        <p className="text-sm font-semibold text-white">
                          Rhizosphere Soil Moisture &amp; Texture Profile
                        </p>
                      </div>
                      <div className="hidden sm:flex items-center gap-2 text-xs font-mono" style={{ color: '#9BAAA5' }}>
                        <span className="px-2 py-1 rounded bg-black/50 border border-white/10 text-white">
                          DEPTH: 0-5 CM / 0-100 CM
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Soil Type */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6B7F79' }}>
                      Soil Type
                    </label>
                    <select
                      value={soilProfile.soilType}
                      onChange={(e) => setSoilProfile({ ...soilProfile, soilType: e.target.value })}
                      className="input"
                    >
                      {soilTypes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  {/* pH */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6B7F79' }}>
                      Soil pH
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="4"
                      max="9"
                      value={soilProfile.ph}
                      onChange={(e) => setSoilProfile({ ...soilProfile, ph: parseFloat(e.target.value) })}
                      className="input"
                    />
                  </div>

                  {/* Organic Matter */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6B7F79' }}>
                      Organic Matter (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={soilProfile.organicMatter}
                      onChange={(e) =>
                        setSoilProfile({ ...soilProfile, organicMatter: parseFloat(e.target.value) })
                      }
                      className="input"
                    />
                  </div>

                  {/* Drainage */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6B7F79' }}>
                      Drainage
                    </label>
                    <select
                      value={soilProfile.drainage}
                      onChange={(e) => setSoilProfile({ ...soilProfile, drainage: e.target.value })}
                      className="input"
                    >
                      {drainageOptions.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  {/* Nitrogen */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6B7F79' }}>
                      Nitrogen
                    </label>
                    <select
                      value={soilProfile.nitrogen}
                      onChange={(e) => setSoilProfile({ ...soilProfile, nitrogen: e.target.value })}
                      className="input"
                    >
                      {nutrientLevels.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>

                  {/* Phosphorus */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6B7F79' }}>
                      Phosphorus
                    </label>
                    <select
                      value={soilProfile.phosphorus}
                      onChange={(e) => setSoilProfile({ ...soilProfile, phosphorus: e.target.value })}
                      className="input"
                    >
                      {nutrientLevels.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Current Crop */}
            {currentStep === 3 && (
              <div>
                <h2 className="text-lg font-semibold mb-2" style={{ color: '#F5F7F2' }}>
                  Current or Most Recent Crop
                </h2>
                <p className="text-sm mb-6" style={{ color: '#9BAAA5' }}>
                  Select the crop currently growing or most recently harvested on your field.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {cropCatalog.map((crop) => (
                    <button
                      key={crop.id}
                      onClick={() => setCurrentCrop(crop.name)}
                      className="p-4 rounded-xl text-left transition-all"
                      style={{
                        background:
                          currentCrop === crop.name
                            ? `${crop.color}10`
                            : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${
                          currentCrop === crop.name
                            ? `${crop.color}40`
                            : 'rgba(255,255,255,0.06)'
                        }`,
                      }}
                    >
                      <CropIcon
                        name={crop.name}
                        icon={crop.icon}
                        color={crop.color}
                        size={22}
                        showBadge
                        className="mb-2.5"
                      />
                      <p className="text-sm font-medium" style={{ color: '#F5F7F2' }}>
                        {crop.name}
                      </p>
                      <p className="text-xs mt-1" style={{ color: '#6B7F79' }}>
                        {crop.season}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Droplets size={10} style={{ color: '#4EC4B1' }} />
                        <span className="text-[10px] font-mono" style={{ color: '#9BAAA5' }}>
                          {crop.waterDemand}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Water Availability */}
            {currentStep === 4 && (
              <div>
                <h2 className="text-lg font-semibold mb-2" style={{ color: '#F5F7F2' }}>
                  Water Availability
                </h2>
                <p className="text-sm mb-6" style={{ color: '#9BAAA5' }}>
                  Describe water availability and irrigation type for your field.
                </p>

                <div className="mb-6">
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6B7F79' }}>
                    Water Availability Level
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['High', 'Moderate', 'Limited'] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => setWaterAvailability(level)}
                        className="p-4 rounded-xl text-center transition-all"
                        style={{
                          background:
                            waterAvailability === level
                              ? 'rgba(6, 61, 145, 0.1)'
                              : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${
                            waterAvailability === level
                              ? 'rgba(6, 61, 145, 0.3)'
                              : 'rgba(255,255,255,0.06)'
                          }`,
                          color: waterAvailability === level ? '#F5F7F2' : '#9BAAA5',
                        }}
                      >
                        <Droplets
                          size={20}
                          className="mx-auto mb-2"
                          style={{
                            color: waterAvailability === level ? '#063D91' : '#6B7F79',
                          }}
                        />
                        <p className="text-sm font-medium">{level}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6B7F79' }}>
                    Irrigation Type
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['Irrigated', 'Rain-fed', 'Mixed'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setIrrigationType(type)}
                        className="p-4 rounded-xl text-center transition-all"
                        style={{
                          background:
                            irrigationType === type
                              ? 'rgba(78, 196, 177, 0.1)'
                              : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${
                            irrigationType === type
                              ? 'rgba(78, 196, 177, 0.3)'
                              : 'rgba(255,255,255,0.06)'
                          }`,
                          color: irrigationType === type ? '#F5F7F2' : '#9BAAA5',
                        }}
                      >
                        <p className="text-sm font-medium">{type}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Farmer Priorities */}
            {currentStep === 5 && (
              <div>
                <h2 className="text-lg font-semibold mb-2" style={{ color: '#F5F7F2' }}>
                  Your Priorities
                </h2>
                <p className="text-sm mb-6" style={{ color: '#9BAAA5' }}>
                  Rate what matters most to you. FarmShift uses these to weight scenario comparisons.
                </p>

                <div className="space-y-5">
                  {Object.entries(priorityLabels).map(([key, label]) => {
                    const value = priorities[key as keyof typeof priorities];
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium" style={{ color: '#F5F7F2' }}>
                            {label}
                          </span>
                          <span
                            className="text-sm font-mono font-bold w-8 text-center"
                            style={{ color: '#063D91' }}
                          >
                            {value}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={value}
                          onChange={(e) =>
                            handlePriorityChange(key, parseInt(e.target.value))
                          }
                          className="w-full"
                        />
                        <div className="flex justify-between mt-1">
                          <span className="text-[10px] font-mono" style={{ color: '#6B7F79' }}>
                            Low
                          </span>
                          <span className="text-[10px] font-mono" style={{ color: '#6B7F79' }}>
                            High
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Priority visualization */}
                <div
                  className="mt-6 p-4 rounded-xl"
                  style={{
                    background: 'rgba(6, 61, 145, 0.05)',
                    border: '1px solid rgba(6, 61, 145, 0.1)',
                  }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6B7F79' }}>
                    Priority Visualization
                  </p>
                  <div className="space-y-2">
                    {Object.entries(priorityLabels)
                      .sort(
                        ([a], [b]) =>
                          (priorities[b as keyof typeof priorities] || 0) -
                          (priorities[a as keyof typeof priorities] || 0)
                      )
                      .map(([key, label]) => {
                        const value = priorities[key as keyof typeof priorities];
                        return (
                          <div key={key} className="flex items-center gap-3">
                            <span className="text-xs w-36 shrink-0" style={{ color: '#9BAAA5' }}>
                              {label}
                            </span>
                            <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${value * 10}%` }}
                                className="h-full rounded-full"
                                style={{ background: '#063D91' }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="btn-secondary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
            Back
          </button>

          {currentStep < 5 ? (
            <button onClick={handleNext} className="btn-primary">
              Next
              <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleComplete} className="btn-primary">
              Complete Setup
              <Check size={16} />
            </button>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
