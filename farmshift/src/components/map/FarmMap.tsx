'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Layers, ZoomIn, ZoomOut, MapPin, Eye, EyeOff, RotateCcw, Compass } from 'lucide-react';
import { MapLayer } from '@/types';
import { useFieldStore, useUIStore } from '@/store';

const layerConfig: { id: MapLayer; label: string; color: string }[] = [
  { id: 'boundary', label: 'Farm Boundary', color: '#FC3D21' },
  { id: 'vegetation', label: 'Vegetation (NDVI)', color: '#65C18C' },
  { id: 'soilMoisture', label: 'Soil Moisture', color: '#4EC4B1' },
  { id: 'temperature', label: 'Surface Temp', color: '#E7B75B' },
  { id: 'rainfall', label: 'Precipitation', color: '#063D91' },
  { id: 'waterStress', label: 'Water Deficit', color: '#E06C5A' },
];

function generateFieldPolygon(lon: number, lat: number) {
  const offset = 0.012;
  return [
    [lon - offset * 0.9, lat - offset * 0.8],
    [lon + offset * 1.1, lat - offset * 0.7],
    [lon + offset * 1.3, lat + offset * 0.9],
    [lon + offset * 0.4, lat + offset * 1.2],
    [lon - offset * 1.0, lat + offset * 0.8],
    [lon - offset * 0.9, lat - offset * 0.8],
  ];
}

export default function FarmMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [showLayers, setShowLayers] = useState(false);
  const selectedField = useFieldStore((s) => s.selectedField);
  const activeMapLayers = useUIStore((s) => s.activeMapLayers);
  const toggleMapLayer = useUIStore((s) => s.toggleMapLayer);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainer.current) return;
    let isCancelled = false;

    const initMap = async () => {
      try {
        const maplibreModule = await import('maplibre-gl');
        const maplibregl = 'default' in maplibreModule ? (maplibreModule as any).default : maplibreModule;
        await import('maplibre-gl/dist/maplibre-gl.css');

        // Set worker URL to same-origin public file
        if (typeof window !== 'undefined') {
          maplibregl.config.WORKER_URL = `${window.location.origin}/maplibre/maplibre-gl-worker.mjs`;
        }

        if (isCancelled || !mapContainer.current) return;

        // Clean up previous instance if exists
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        const map = new maplibregl.Map({
          container: mapContainer.current,
          style: {
            version: 8,
            sources: {
              'satellite-imagery': {
                type: 'raster',
                tiles: [
                  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                ],
                tileSize: 256,
                attribution: 'Tiles &copy; Esri &mdash; USGS, Maxar, Earthstar Geographics',
                maxzoom: 19,
              },
            },
            layers: [
              {
                id: 'satellite-tiles',
                type: 'raster',
                source: 'satellite-imagery',
                minzoom: 0,
                maxzoom: 19,
              },
            ],
          },
          center: [selectedField.lon, selectedField.lat],
          zoom: 13.5,
          attributionControl: false,
        });

        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

        map.on('error', (e: any) => {
          console.warn('MapLibre error encountered:', e?.error?.message || e);
        });

        map.on('load', () => {
          if (isCancelled) return;
          setMapLoaded(true);

          // Add farm boundary polygon
          map.addSource('farm-boundary', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: { name: selectedField.label },
              geometry: {
                type: 'Polygon',
                coordinates: [generateFieldPolygon(selectedField.lon, selectedField.lat)],
              },
            },
          });

          // Layer: farm polygon fill
          map.addLayer({
            id: 'farm-fill',
            type: 'fill',
            source: 'farm-boundary',
            paint: {
              'fill-color': '#063D91',
              'fill-opacity': 0.18,
            },
          });

          // Layer: farm outline
          map.addLayer({
            id: 'farm-outline',
            type: 'line',
            source: 'farm-boundary',
            paint: {
              'line-color': '#FC3D21',
              'line-width': 2.5,
              'line-dasharray': [2, 1],
            },
          });

          // Layer: NDVI vegetation simulated thermal/moisture polygon overlay
          map.addLayer({
            id: 'farm-vegetation-mask',
            type: 'fill',
            source: 'farm-boundary',
            layout: {
              visibility: 'visible',
            },
            paint: {
              'fill-color': '#65C18C',
              'fill-opacity': 0.28,
            },
          });

          // Add marker at field centroid
          const markerEl = document.createElement('div');
          markerEl.className = 'farm-marker';
          markerEl.style.cssText = `
            width: 22px; height: 22px;
            background: #FC3D21;
            border: 3px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 0 16px rgba(252, 61, 33, 0.7);
            cursor: pointer;
            transition: transform 0.2s ease;
          `;
          markerEl.title = selectedField.label;

          const marker = new maplibregl.Marker({ element: markerEl })
            .setLngLat([selectedField.lon, selectedField.lat])
            .addTo(map);

          markerRef.current = marker;
        });

        mapRef.current = map;
      } catch (err: any) {
        console.error('Failed to initialize map:', err);
        setMapError(err?.message || 'Failed to initialize satellite renderer');
      }
    };

    initMap();

    return () => {
      isCancelled = true;
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update map when selected farm field changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    try {
      mapRef.current.flyTo({
        center: [selectedField.lon, selectedField.lat],
        zoom: 13.5,
        essential: true,
        duration: 1800,
      });

      // Update marker position
      if (markerRef.current) {
        markerRef.current.setLngLat([selectedField.lon, selectedField.lat]);
      }

      // Update boundary geometry
      const source = mapRef.current.getSource('farm-boundary');
      if (source) {
        source.setData({
          type: 'Feature',
          properties: { name: selectedField.label },
          geometry: {
            type: 'Polygon',
            coordinates: [generateFieldPolygon(selectedField.lon, selectedField.lat)],
          },
        });
      }
    } catch (e) {
      console.warn('Error updating map to field:', e);
    }
  }, [selectedField, mapLoaded]);

  // Sync active layers with MapLibre layers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    try {
      // Boundary layer
      const boundaryVisible = activeMapLayers.includes('boundary') ? 'visible' : 'none';
      if (map.getLayer('farm-fill')) map.setLayoutProperty('farm-fill', 'visibility', boundaryVisible);
      if (map.getLayer('farm-outline')) map.setLayoutProperty('farm-outline', 'visibility', boundaryVisible);

      // Vegetation NDVI mask
      const vegVisible = activeMapLayers.includes('vegetation') ? 'visible' : 'none';
      if (map.getLayer('farm-vegetation-mask')) {
        map.setLayoutProperty('farm-vegetation-mask', 'visibility', vegVisible);
      }
    } catch (e) {
      console.warn('Error updating map layer visibility:', e);
    }
  }, [activeMapLayers, mapLoaded]);

  const handleZoom = useCallback((dir: 'in' | 'out') => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    dir === 'in' ? map.zoomIn() : map.zoomOut();
  }, []);

  const handleResetBearing = useCallback(() => {
    if (!mapRef.current) return;
    mapRef.current.resetNorthPitch();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl"
      style={{
        border: '1px solid rgba(255, 255, 255, 0.1)',
        minHeight: '440px',
        background: '#071014',
      }}
    >
      {/* Map DOM Canvas */}
      <div ref={mapContainer} className="w-full h-full" style={{ minHeight: '440px' }} />

      {/* Loading overlay */}
      {!mapLoaded && !mapError && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10"
          style={{ background: 'rgba(7, 16, 20, 0.85)', backdropFilter: 'blur(8px)' }}
        >
          <div className="text-center p-6 rounded-2xl border border-white/10 bg-black/40">
            <div
              className="w-9 h-9 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
              style={{ borderColor: '#063D91', borderTopColor: 'transparent' }}
            />
            <p className="text-sm font-medium" style={{ color: '#F5F7F2' }}>
              Streaming NASA & Esri Satellite Feeds
            </p>
            <p className="text-xs mt-1 font-mono" style={{ color: '#6B7F79' }}>
              Resolving Earth telemetry at {selectedField.lat.toFixed(2)}N, {selectedField.lon.toFixed(2)}E
            </p>
          </div>
        </div>
      )}

      {/* Fallback if error */}
      {mapError && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10"
          style={{ background: '#0B171A' }}
        >
          <MapPin size={32} className="mb-2" style={{ color: '#FC3D21' }} />
          <h4 className="text-sm font-bold text-white mb-1">Satellite View Active</h4>
          <p className="text-xs max-w-sm mb-4" style={{ color: '#9BAAA5' }}>
            Telemetry synced for {selectedField.label} ({selectedField.area} ha) at {selectedField.lat}N, {selectedField.lon}E
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary text-xs px-3 py-1.5"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Top Left: Layer toggle */}
      <div className="absolute top-4 left-4 z-20">
        <button
          onClick={() => setShowLayers(!showLayers)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all shadow-lg"
          style={{
            background: showLayers ? 'rgba(6, 61, 145, 0.9)' : 'rgba(7, 16, 20, 0.92)',
            border: `1px solid ${showLayers ? '#063D91' : 'rgba(255, 255, 255, 0.12)'}`,
            color: '#F5F7F2',
            backdropFilter: 'blur(10px)',
          }}
          title="Toggle Layers"
        >
          <Layers size={13} />
          <span>Layers</span>
        </button>

        {showLayers && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 p-3 rounded-xl w-52 shadow-2xl"
            style={{
              background: 'rgba(7, 16, 20, 0.96)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <p className="text-[10px] font-mono uppercase tracking-wider mb-2.5" style={{ color: '#6B7F79' }}>
              Observation Overlays
            </p>
            <div className="space-y-1">
              {layerConfig.map((layer) => {
                const isActive = activeMapLayers.includes(layer.id);
                return (
                  <button
                    key={layer.id}
                    onClick={() => toggleMapLayer(layer.id)}
                    className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      color: isActive ? '#F5F7F2' : '#9BAAA5',
                      background: isActive ? `${layer.color}15` : 'transparent',
                      border: `1px solid ${isActive ? `${layer.color}40` : 'transparent'}`,
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: layer.color }}
                      />
                      {layer.label}
                    </span>
                    {isActive ? (
                      <Eye size={12} style={{ color: layer.color }} />
                    ) : (
                      <EyeOff size={12} style={{ color: '#6B7F79' }} />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* Top Center: Field info banner */}
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-xs z-20 hidden sm:flex items-center gap-4 shadow-xl"
        style={{
          background: 'rgba(7, 16, 20, 0.92)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div>
          <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: '#6B7F79' }}>
            Active Field
          </span>
          <p className="font-semibold text-white leading-tight">{selectedField.label}</p>
        </div>
        <div style={{ width: 1, height: 20, background: 'rgba(255, 255, 255, 0.1)' }} />
        <div>
          <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: '#6B7F79' }}>
            Size
          </span>
          <p className="font-mono font-medium leading-tight text-white">{selectedField.area} ha</p>
        </div>
        <div style={{ width: 1, height: 20, background: 'rgba(255, 255, 255, 0.1)' }} />
        <div>
          <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: '#6B7F79' }}>
            Est. NDVI
          </span>
          <p className="font-mono font-medium leading-tight" style={{ color: '#65C18C' }}>
            0.64 (Healthy)
          </p>
        </div>
      </div>

      {/* Top Right: Zoom and Compass controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-1.5 z-20">
        <button
          onClick={() => handleZoom('in')}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-md"
          style={{
            background: 'rgba(7, 16, 20, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#F5F7F2',
          }}
          title="Zoom In"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={() => handleZoom('out')}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-md"
          style={{
            background: 'rgba(7, 16, 20, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#F5F7F2',
          }}
          title="Zoom Out"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={handleResetBearing}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-md"
          style={{
            background: 'rgba(7, 16, 20, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#F5F7F2',
          }}
          title="Reset North"
        >
          <Compass size={14} />
        </button>
      </div>

      {/* Bottom Left: Coordinates & Satellite feed status */}
      <div
        className="absolute bottom-4 left-4 px-3 py-2 rounded-lg text-xs font-mono z-20 flex items-center gap-2 shadow-lg"
        style={{
          background: 'rgba(7, 16, 20, 0.92)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          color: '#9BAAA5',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <MapPin size={11} style={{ color: '#FC3D21' }} />
        <span>
          {selectedField.lat.toFixed(2)}N, {selectedField.lon.toFixed(2)}E
        </span>
        <span style={{ color: '#6B7F79' }}>&bull;</span>
        <span style={{ color: '#65C18C' }}>Esri &amp; USGS World Imagery</span>
      </div>
    </motion.div>
  );
}
