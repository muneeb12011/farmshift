'use client';

import { useMemo } from 'react';
import { useFarmProfileStore, useFieldStore } from '@/store';
import type { ScenarioRequest } from '@/services/api';

/** The selected field + farm profile from the stores, as a backend scenario request (stable between renders). */
export function useScenarioRequest(): ScenarioRequest {
  const field = useFieldStore((s) => s.selectedField);
  const soil = useFarmProfileStore((s) => s.soilProfile);
  const currentCrop = useFarmProfileStore((s) => s.currentCrop);
  const waterAvailability = useFarmProfileStore((s) => s.waterAvailability);
  const irrigationType = useFarmProfileStore((s) => s.irrigationType);
  const priorities = useFarmProfileStore((s) => s.priorities);

  return useMemo(
    () => ({
      field: { lat: field.lat, lon: field.lon },
      profile: { soil, currentCrop, waterAvailability, irrigationType, priorities },
    }),
    [field.lat, field.lon, soil, currentCrop, waterAvailability, irrigationType, priorities],
  );
}
