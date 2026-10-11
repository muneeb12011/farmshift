'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { cropCatalog } from '@/data/mockCropCatalog';
import { useScenarioStore } from '@/store';
import { fetchScenarioRun, setRotationPreference } from '@/services/api';
import { useScenarioRequest } from '@/hooks/useScenarioRequest';
import {
  ArrowDown,
  Plus,
  X,
  Zap,
  Droplets,
  Leaf,
  Clock,
  ChevronRight,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { CropInfo } from '@/types';
import CropIcon from '@/components/ui/CropIcon';

export default function RotationBuilderPage() {
  const router = useRouter();
  const setScenariosGenerated = useScenarioStore((s) => s.setScenariosGenerated);
  const [rotation, setRotation] = useState<CropInfo[]>([cropCatalog[0]]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [showCropPicker, setShowCropPicker] = useState<number | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const scenarioRequest = useScenarioRequest();

  const generationSteps = [
    'Analyzing field conditions...',
    'Reviewing environmental data...',
    'Comparing crop characteristics...',
    'Building rotation scenarios...',
  ];

  const addCrop = useCallback(() => {
    const available = cropCatalog.filter((c) => !rotation.find((r) => r.id === c.id));
    if (available.length > 0) {
      setRotation([...rotation, available[0]]);
    }
  }, [rotation]);

  const removeCrop = useCallback((index: number) => {
    if (rotation.length > 1) {
      setRotation(rotation.filter((_, i) => i !== index));
    }
  }, [rotation]);

  const replaceCrop = useCallback((index: number, crop: CropInfo) => {
    const newRotation = [...rotation];
    newRotation[index] = crop;
    setRotation(newRotation);
    setShowCropPicker(null);
  }, [rotation]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationStep(0);
    setGenerateError(null);

    // Real request runs behind the progress animation; the scenarios page reuses its result.
    const rotationIds = rotation.map((c) => c.id);
    setRotationPreference(rotationIds);
    const request = fetchScenarioRun({ ...scenarioRequest, rotation: rotationIds }).then(
      () => null,
      (e: unknown) => (e instanceof Error ? e : new Error('Scenario generation failed')),
    );

    for (let i = 0; i < generationSteps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setGenerationStep(i + 1);
    }

    const failure = await request;
    if (failure) {
      setGenerateError(failure.message);
      setIsGenerating(false);
      return;
    }
    setScenariosGenerated(true);
    router.push('/scenarios');
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      <Navbar />

      <main className="pt-20 pb-12 px-4 md:px-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold" style={{ color: '#F5F7F2' }}>
            Rotation Builder
          </h1>
          <p className="text-sm mt-1" style={{ color: '#9BAAA5' }}>
            Build a crop-rotation sequence, then generate scenario comparisons.
          </p>
        </motion.div>

        {/* Animated Crop Rotation Visual Banner */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-6 rounded-2xl overflow-hidden card relative shadow-xl"
          style={{ border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="relative w-full h-[180px] sm:h-[220px] overflow-hidden">
            <div className="w-full h-full relative animate-ken-burns">
              <Image
                src="/crop-rotation-landscape.jpg"
                alt="Diverse crop rotation strips showing alternating wheat, legumes, and canopy cover"
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
                  'linear-gradient(to top, rgba(7, 16, 20, 0.95) 0%, rgba(7, 16, 20, 0.3) 60%, transparent 100%)',
              }}
            />
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                  Agroecological Sequence Modeler
                </span>
                <p className="text-sm font-semibold text-white">
                  Multi-Year Crop Succession Planning
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-xs font-mono" style={{ color: '#9BAAA5' }}>
                <span className="px-2 py-1 rounded bg-black/40 border border-white/10 text-white">
                  Active Years: {rotation.length}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Rotation Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-6 md:p-8 mb-6"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-6" style={{ color: '#6B7F79' }}>
            Rotation Sequence
          </h2>

          <div className="space-y-4">
            {rotation.map((crop, index) => (
              <div key={`${crop.id}-${index}`}>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative flex items-stretch gap-4 p-4 rounded-xl transition-all"
                  style={{
                    background: `${crop.color}08`,
                    border: `1px solid ${crop.color}20`,
                  }}
                >
                  {/* Year label */}
                  <div className="flex flex-col items-center justify-center px-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#6B7F79' }}>
                      Year
                    </span>
                    <span
                      className="text-2xl font-bold font-mono"
                      style={{ color: crop.color }}
                    >
                      {index + 1}
                    </span>
                  </div>

                  {/* Crop card */}
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => setShowCropPicker(showCropPicker === index ? null : index)}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <CropIcon name={crop.name} icon={crop.icon} color={crop.color} size={22} showBadge />
                      <h3 className="text-lg font-semibold" style={{ color: '#F5F7F2' }}>
                        {crop.name}
                      </h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Droplets size={11} style={{ color: '#4EC4B1' }} />
                        <span style={{ color: '#9BAAA5' }}>{crop.waterDemand} water</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={11} style={{ color: '#E7B75B' }} />
                        <span style={{ color: '#9BAAA5' }}>{crop.season}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Leaf size={11} style={{ color: '#65C18C' }} />
                        <span style={{ color: '#9BAAA5' }}>{crop.rootingDepth}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Zap size={11} style={{ color: '#E06C5A' }} />
                        <span style={{ color: '#9BAAA5' }}>{crop.nutrientDemand} nutrient</span>
                      </div>
                    </div>
                  </div>

                  {/* Remove button */}
                  {rotation.length > 1 && (
                    <button
                      onClick={() => removeCrop(index)}
                      className="self-start p-1.5 rounded-lg transition-colors hover:bg-white/[0.06]"
                      style={{ color: '#6B7F79' }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </motion.div>

                {/* Crop picker dropdown */}
                <AnimatePresence>
                  {showCropPicker === index && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div
                        className="mt-2 p-3 rounded-xl grid grid-cols-2 sm:grid-cols-3 gap-2"
                        style={{
                          background: 'rgba(11, 23, 26, 0.95)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        {cropCatalog.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => replaceCrop(index, c)}
                            className="flex items-center gap-2 p-2.5 rounded-lg text-left transition-all hover:bg-white/[0.04]"
                            style={{
                              border: `1px solid ${c.id === crop.id ? `${c.color}30` : 'transparent'}`,
                              background: c.id === crop.id ? `${c.color}10` : 'transparent',
                            }}
                          >
                            <CropIcon name={c.name} icon={c.icon} color={c.color} size={18} showBadge />
                            <div>
                              <p className="text-xs font-medium" style={{ color: '#F5F7F2' }}>{c.name}</p>
                              <p className="text-[10px]" style={{ color: '#6B7F79' }}>{c.waterDemand} water</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Arrow between crops */}
                {index < rotation.length - 1 && (
                  <div className="flex justify-center py-2">
                    <ArrowDown size={18} style={{ color: '#6B7F79' }} />
                  </div>
                )}
              </div>
            ))}

            {/* Add crop button */}
            {rotation.length < 5 && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={addCrop}
                className="w-full py-4 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all"
                style={{
                  border: '2px dashed rgba(255,255,255,0.1)',
                  color: '#6B7F79',
                  background: 'transparent',
                }}
              >
                <Plus size={16} />
                Add Year to Rotation
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* Generate Scenarios button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-6 md:p-8"
        >
          {!isGenerating ? (
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2" style={{ color: '#F5F7F2' }}>
                Generate Scenarios
              </h3>
              <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: '#9BAAA5' }}>
                Based on your field, environmental data, and priorities, FarmShift will generate
                crop-rotation scenarios for comparison.
              </p>
              {generateError && (
                <p
                  className="text-sm mb-4 max-w-md mx-auto px-4 py-3 rounded-lg"
                  style={{ background: 'rgba(224,108,90,0.1)', border: '1px solid rgba(224,108,90,0.3)', color: '#E06C5A' }}
                >
                  {generateError}
                </p>
              )}
              <button onClick={handleGenerate} className="btn-primary text-base">
                <Sparkles size={18} />
                Generate Scenarios
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="mb-6">
                <Loader2
                  size={40}
                  className="mx-auto animate-spin"
                  style={{ color: '#063D91' }}
                />
              </div>
              <div className="space-y-3 max-w-sm mx-auto">
                {generationSteps.map((step, i) => (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{
                      opacity: i < generationStep ? 1 : 0.3,
                      x: 0,
                    }}
                    transition={{ delay: i * 0.2 }}
                    className="flex items-center gap-3 text-sm"
                  >
                    {i < generationStep ? (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(101, 193, 140, 0.2)' }}
                      >
                        <div className="w-2 h-2 rounded-full" style={{ background: '#65C18C' }} />
                      </div>
                    ) : (
                      <div
                        className="w-5 h-5 rounded-full shrink-0 animate-pulse-soft"
                        style={{ border: '2px solid rgba(6, 61, 145, 0.3)' }}
                      />
                    )}
                    <span style={{ color: i < generationStep ? '#F5F7F2' : '#6B7F79' }}>
                      {step}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
