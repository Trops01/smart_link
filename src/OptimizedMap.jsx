// ─────────────────────────────────────────────────────────────────────────────
// Instrukcja instalacji wymaganych paczek (jeśli jeszcze ich nie masz):
// npm install react-leaflet leaflet lucide-react
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Users, Clock, Route as RouteIcon, AlertTriangle, PlayCircle } from 'lucide-react';

// ─── Dane Testowe (Okolice Poznania) ──────────────────────────────────────────
const MOCK_REQUESTS = [
  { id: 1, name: "Jan (Senior)", passengers: 1, pickup: { lat: 52.380, lng: 16.900 }, dropoff: { lat: 52.405, lng: 16.920 } },
  { id: 2, name: "Szkoła (Grupa)", passengers: 3, pickup: { lat: 52.390, lng: 16.890 }, dropoff: { lat: 52.410, lng: 16.930 } },
  { id: 3, name: "Kasia (Studentka)", passengers: 1, pickup: { lat: 52.385, lng: 16.910 }, dropoff: { lat: 52.400, lng: 16.925 } },
  // Poniższe zlecenie zostanie odrzucone z Pierwszego Kursu z powodu przekroczenia miejsc (1+3+1 = 5, limit to 5)
  { id: 4, name: "Marek (Praca)", passengers: 1, pickup: { lat: 52.370, lng: 16.880 }, dropoff: { lat: 52.390, lng: 16.910 } },
  // Poniższe zlecenie zostanie odrzucone, bo punkt startowy jest zbyt oddalony (zbyt długi czas przejazdu)
  { id: 5, name: "Piotr (Daleka trasa)", passengers: 1, pickup: { lat: 52.200, lng: 16.500 }, dropoff: { lat: 52.400, lng: 16.900 } },
];

// ─── Ikony (Strzałki: Zielona Odbiór, Czerwona Dowóz) ─────────────────────────
const getIcon = (type, isDimmed, isHovered) => {
  const color = type === 'pickup' ? '#22c55e' : '#ef4444'; 
  const rotation = type === 'pickup' ? '0deg' : '180deg';
  const scale = isHovered ? 'scale(1.2)' : 'scale(1)';
  const opacity = isDimmed ? 0.3 : 1;
  const zIndex = isHovered ? 1000 : 1;

  return L.divIcon({
    html: `<div style="transform: rotate(${rotation}) ${scale}; opacity: ${opacity}; transition: all 0.3s ease; z-index: ${zIndex}; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
      <svg viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5" width="36" height="36">
        <path d="M12 2L22 22L12 18L2 22L12 2Z" stroke-linejoin="round" />
      </svg>
    </div>`,
    className: '', iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -18]
  });
};

export default function OptimizedMap() {
  const [routeData, setRouteData] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [isCalculating, setIsCalculating] = useState(true);

  // 1. Logika biznesowa: Rozdzielanie kursów
  const { run1, run2, stats } = useMemo(() => {
    const accepted = [];
    const rejected = [];
    let currentPassengers = 0;

    MOCK_REQUESTS.forEach(req => {
      // Prosta heurystyka odległości (w linii prostej) jako estymator czasu dojazdu
      const dist = Math.sqrt(Math.pow(req.pickup.lat - req.dropoff.lat, 2) + Math.pow(req.pickup.lng - req.dropoff.lng, 2));
      
      if (dist > 0.05) {
        rejected.push({ ...req, rejectReason: "Zbyt długi czas dojazdu (przesunięto na Kurs 2)" });
      } else if (currentPassengers + req.passengers > 5) {
        rejected.push({ ...req, rejectReason: "Brak miejsc (maks. 5 osób w busie)" });
      } else {
        accepted.push(req);
        currentPassengers += req.passengers;
      }
    });

    return { run1: accepted, run2: rejected, stats: { passengers: currentPassengers } };
  }, []);

  // 2. Fetch optymalizacji trasy (OSRM Trip API)
  useEffect(() => {
    async function fetchOptimizedRoute() {
      setIsCalculating(true);
      
      // Zbieramy współrzędne dla OSRM (tylko pasażerowie z Run 1)
      const points = [];
      run1.forEach(req => {
        points.push(`${req.pickup.lng},${req.pickup.lat}`);
        points.push(`${req.dropoff.lng},${req.dropoff.lat}`);
      });

      // Zmuszamy OSRM do nie-zamykania pętli (roundtrip=false) 
      const url = `https://router.project-osrm.org/trip/v1/driving/${points.join(';')}?roundtrip=false&source=first&destination=last&geometries=geojson`;

      try {
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.code === 'Ok') {
          // Zapisujemy wyliczoną trasę i jej metadane
          setRouteData({
            geometry: data.trips[0].geometry,
            distance: (data.trips[0].distance / 1000).toFixed(1), // w km
            duration: Math.round(data.trips[0].duration / 60)     // w minutach
          });
        }
      } catch (err) {
        console.error("Błąd algorytmu OSRM:", err);
      } finally {
        setIsCalculating(false);
      }
    }

    fetchOptimizedRoute();
  }, [run1]);

  // Pomocnicza funkcja formatująca
  const formatTime = (minutes) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

  return (
    <div className="flex h-screen w-full bg-[#f2f2f7] font-sans overflow-hidden">
      
      {/* ════ PANEL LEWY: Algorytm & Lista Zgłoszeń ════ */}
      <aside className="w-1/3 min-w-[400px] bg-white shadow-2xl z-10 flex flex-col h-full border-r border-gray-200">
        
        {/* Nagłówek Panelu */}
        <div className="p-6 bg-gradient-to-br from-[#007aff] to-[#005bb5] text-white">
          <div className="flex items-center gap-3 mb-2">
            <PlayCircle className="w-8 h-8 opacity-90 animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight">Algorytm SmartLink</h1>
          </div>
          <p className="text-blue-100 text-sm font-medium opacity-90">Optymalizacja tras na żywo (OSRM AI)</p>
        </div>

        {/* Statystyki wyliczone przez API */}
        <div className="grid grid-cols-3 gap-px bg-gray-100 border-b border-gray-200">
          <div className="bg-white p-4 text-center">
            <RouteIcon className="w-5 h-5 mx-auto text-[#007aff] mb-1" />
            <div className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Dystans</div>
            <div className="text-lg font-bold text-gray-900">{routeData?.distance || '--'} km</div>
          </div>
          <div className="bg-white p-4 text-center">
            <Clock className="w-5 h-5 mx-auto text-[#007aff] mb-1" />
            <div className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Estymacja</div>
            <div className="text-lg font-bold text-gray-900">{routeData ? formatTime(routeData.duration) : '--'}</div>
          </div>
          <div className="bg-white p-4 text-center">
            <Users className="w-5 h-5 mx-auto text-[#007aff] mb-1" />
            <div className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Miejsca</div>
            <div className="text-lg font-bold text-gray-900">{stats.passengers} / 5</div>
          </div>
        </div>

        {/* Listy Pasażerów */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Aktywny Kurs */}
          <section>
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#34c759]"></div>
              Kurs 1 (Zoptymalizowany)
            </h2>
            <div className="space-y-3">
              {run1.map(req => (
                <div 
                  key={req.id} 
                  onMouseEnter={() => setHoveredId(req.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${hoveredId === req.id ? 'border-[#007aff] bg-blue-50 shadow-md transform scale-[1.02]' : 'border-gray-200 bg-white hover:border-blue-300'}`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-gray-900">{req.name}</span>
                    <span className="text-xs font-bold bg-blue-100 text-[#007aff] px-2 py-1 rounded">Osób: {req.passengers}</span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div className="flex items-center gap-1.5"><span className="text-[#22c55e] font-bold">↑</span> Odbiór: [{req.pickup.lat.toFixed(3)}, {req.pickup.lng.toFixed(3)}]</div>
                    <div className="flex items-center gap-1.5"><span className="text-[#ef4444] font-bold">↓</span> Dowóz: [{req.dropoff.lat.toFixed(3)}, {req.dropoff.lng.toFixed(3)}]</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Oczekujący na Kurs 2 */}
          <section>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#ff3b30]"></div>
              Oczekujący (Kurs 2)
            </h2>
            <div className="space-y-3 opacity-75">
              {run2.map(req => (
                <div key={req.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-gray-700">{req.name}</span>
                    <span className="text-xs font-bold bg-gray-200 text-gray-600 px-2 py-1 rounded">Osób: {req.passengers}</span>
                  </div>
                  <div className="flex items-start gap-2 mt-2 p-2 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{req.rejectReason}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>

      {/* ════ PANEL PRAWY: Interaktywna Mapa ════ */}
      <main className="flex-1 relative bg-[#e5e5ea]">
        {isCalculating && (
          <div className="absolute inset-0 z-[1000] bg-white/50 backdrop-blur-sm flex flex-col items-center justify-center">
            <PlayCircle className="w-16 h-16 text-[#007aff] animate-spin mb-4" />
            <p className="text-lg font-bold text-gray-800">Obliczanie macierzy TSP...</p>
          </div>
        )}

        <MapContainer center={[52.39, 16.90]} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
          {/* Szara, minimalistyczna mapa podkładowa */}
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}" />
          
          {/* Rysowanie wyliczonej trasy GeoJSON */}
          {routeData && (
            <GeoJSON 
              key={JSON.stringify(routeData.geometry)} 
              data={routeData.geometry} 
              style={{
                color: '#007aff', 
                weight: 6, 
                opacity: hoveredId ? 0.15 : 0.8 // WYSZARZANIE reszty trasy podczas hovera
              }} 
            />
          )}

          {/* Rysowanie Linii Bezpośredniej tylko dla Hoverowanego Pasażera */}
          {hoveredId && (
            <Polyline 
              positions={[
                [run1.find(r=>r.id===hoveredId).pickup.lat, run1.find(r=>r.id===hoveredId).pickup.lng],
                [run1.find(r=>r.id===hoveredId).dropoff.lat, run1.find(r=>r.id===hoveredId).dropoff.lng]
              ]}
              color="#007aff"
              weight={4}
              dashArray="8, 8"
              opacity={0.8}
            />
          )}

          {/* Renderowanie Markerów Pasażerów (Tylko aktywny kurs) */}
          {run1.map(req => {
            const isHovered = hoveredId === req.id;
            const isDimmed = hoveredId !== null && hoveredId !== req.id;

            return (
              <React.Fragment key={req.id}>
                {/* Marker Odbioru (Zieloona strzałka w górę) */}
                <Marker position={[req.pickup.lat, req.pickup.lng]} icon={getIcon('pickup', isDimmed, isHovered)}>
                  <Popup><strong>Odbiór:</strong> {req.name}</Popup>
                </Marker>
                {/* Marker Celu (Czerwona strzałka w dół) */}
                <Marker position={[req.dropoff.lat, req.dropoff.lng]} icon={getIcon('dropoff', isDimmed, isHovered)}>
                  <Popup><strong>Cel:</strong> {req.name}</Popup>
                </Marker>
              </React.Fragment>
            );
          })}
        </MapContainer>
      </main>

    </div>
  );
}
