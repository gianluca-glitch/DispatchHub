'use client';

import { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { RoutePoint, JobStatus, Borough } from '@/types';
import { JOB_STATUS_LABELS } from '@/types';
import { formatTime } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';

const NYC_CENTER: [number, number] = [40.7128, -74.006];
const BOROUGH_CENTERS: Record<Borough, [number, number]> = {
  MANHATTAN: [40.7831, -73.9712],
  BROOKLYN: [40.6782, -73.9442],
  QUEENS: [40.7282, -73.7949],
  BRONX: [40.8448, -73.8648],
  STATEN_ISLAND: [40.5795, -74.1502],
};

const BOROUGH_NAMES: Record<string, Borough> = {
  manhattan: 'MANHATTAN',
  brooklyn: 'BROOKLYN',
  queens: 'QUEENS',
  bronx: 'BRONX',
  'staten island': 'STATEN_ISLAND',
};

function parseBoroughFromAddress(address: string): Borough | null {
  const lower = address.toLowerCase();
  for (const [name, borough] of Object.entries(BOROUGH_NAMES)) {
    if (lower.includes(name)) return borough;
  }
  return null;
}

function stableOffset(jobId: string): [number, number] {
  let h = 0;
  for (let i = 0; i < jobId.length; i++) h = (h << 5) - h + jobId.charCodeAt(i);
  const u = h >>> 0;
  const a = (u % 1000) / 1000;
  const b = ((u * 31) % 1000) / 1000;
  const signLat = (u % 2 === 0) ? 1 : -1;
  const signLng = ((u >> 1) % 2 === 0) ? 1 : -1;
  return [signLat * (0.005 + a * 0.005), signLng * (0.005 + b * 0.005)];
}

function getStopPosition(stop: RoutePoint): [number, number] {
  const borough = stop.borough ?? parseBoroughFromAddress(stop.address ?? '');
  const [lat, lng] = (borough && BOROUGH_CENTERS[borough]) ? BOROUGH_CENTERS[borough] : NYC_CENTER;
  const [doff, loff] = stableOffset(stop.jobId);
  return [lat + doff, lng + loff];
}

function markerColor(status: JobStatus): string {
  if (status === 'COMPLETED') return '#22c55e';
  if (status === 'IN_PROGRESS') return '#f97316';
  return '#3b82f6';
}

function createMarkerIcon(
  sequence: number,
  status: JobStatus,
  isCurrent: boolean,
  isHighlightJob: boolean
): L.DivIcon {
  const color = markerColor(status);
  const size = isHighlightJob ? 28 : status === 'IN_PROGRESS' && isCurrent ? 28 : 24;
  const pulse = status === 'IN_PROGRESS' && isCurrent ? ' leaflet-marker-pulsing' : '';
  return L.divIcon({
    html: `<div class="leaflet-marker-pin${pulse}" style="width:${size}px;height:${size}px;background:${color};border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);">${sequence}</div>`,
    className: 'custom-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export interface LeafletMapProps {
  stops: RoutePoint[];
  currentStopIndex: number;
  highlightJobId: string | null;
  onStopClick?: (index: number) => void;
  centerOnIndex?: number | null;
}

function CenterOnIndex({ centerOnIndex, positions }: { centerOnIndex: number | null; positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (centerOnIndex == null || centerOnIndex < 0 || centerOnIndex >= positions.length) return;
    const pos = positions[centerOnIndex];
    map.setView(pos, map.getZoom());
  }, [centerOnIndex, positions, map]);
  return null;
}

export function LeafletMap({ stops, currentStopIndex, highlightJobId, onStopClick, centerOnIndex }: LeafletMapProps) {
  const positions = useMemo(() => stops.map((s) => getStopPosition(s)), [stops]);

  return (
    <MapContainer
      center={NYC_CENTER}
      zoom={11}
      className="h-full w-full rounded min-h-[300px]"
      style={{ minHeight: 300 }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <CenterOnIndex centerOnIndex={centerOnIndex ?? null} positions={positions} />
      {positions.length > 1 && (
        <Polyline positions={positions} pathOptions={{ color: '#f97316', weight: 4 }} />
      )}
      {stops.map((stop, idx) => {
        const pos = positions[idx];
        const isCurrent = idx === currentStopIndex && stop.status !== 'COMPLETED';
        const isHighlight = stop.jobId === highlightJobId;
        const icon = createMarkerIcon(stop.sequence + 1, stop.status, isCurrent, !!isHighlight);
        return (
          <Marker
            key={stop.jobId}
            position={pos}
            icon={icon}
            eventHandlers={{
              click: () => onStopClick?.(idx),
            }}
          >
            <Popup>
              <div className="text-sm text-left min-w-[180px]">
                <div className="font-semibold">Stop {stop.sequence + 1}</div>
                <div className="mt-1">{stop.customer}</div>
                <div className="text-gray-500 text-xs">{stop.address}</div>
                <div className="mt-1 font-mono text-xs">{formatTime(stop.time)}</div>
                <div className="mt-0.5 text-xs">{JOB_STATUS_LABELS[stop.status]}</div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
