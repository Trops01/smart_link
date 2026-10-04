import React, { useState, useCallback, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, GeoJSON, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Bus, Crosshair, Loader2, CheckCircle2, User, HelpCircle, XCircle, MapPin, Navigation, Clock, Calendar, AlertTriangle, Archive, History, Search } from "lucide-react";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function getPillMarker(label, dotColor) {
  return L.divIcon({
    html: `<div style="background: white; padding: 6px 14px; border-radius: 999px; font-weight: 800; font-size: 13px; color: #111827; box-shadow: 0 8px 20px rgba(0,0,0,0.12); display: flex; align-items: center; gap: 8px; border: 1px solid #f3f4f6; white-space: nowrap; width: max-content;">
             <div style="width: 10px; height: 10px; border-radius: 50%; background: ${dotColor}; box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);"></div>
             ${label}
          </div>`,
    className: 'leaflet-div-icon', iconSize: [0,0], iconAnchor: [-10, 40]
  });
}

const PIN_PICKUP  = getPillMarker('Odbiór', '#d4ff00');
const PIN_DROPOFF = getPillMarker('Cel', '#000000');
const PIN_WALK    = getPillMarker('Spacer', '#9ca3af');
const PIN_BASE    = getPillMarker('Baza MDA', '#000000');

// W pełni darmowe kafelki OSM, bez błędu API KEY REQUIRED
const MAP_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
      if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
  }, [bounds, map]);
  return null;
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=pl`);
    const data = await res.json();
    return data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch { return `${lat.toFixed(5)}, ${lng.toFixed(5)}`; }
}

function MapClickHandler({ onMapClick, active }) {
  useMapEvents({
    click: async (e) => {
      if (!active) return;
      const { lat, lng } = e.latlng;
      const address = await reverseGeocode(lat, lng);
      onMapClick({ lat, lng, address });
    },
  });
  return null;
}

function AddressSearch({ label, dotColor, value, onSelect, disabled, placeholder }) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState([]);
  useEffect(() => { setQuery(value); }, [value]);
  useEffect(() => {
    if (query.length < 3 || query === value) { setResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=pl&limit=4`);
        const data = await res.json();
        setResults(data);
      } catch(e) {}
    }, 600);
    return () => clearTimeout(timer);
  }, [query, value]);
  return (
    <div className="relative w-full">
      <div className={`flex items-center bg-white border-2 border-gray-100 rounded-full px-5 py-3 transition-colors ${disabled ? 'opacity-50' : 'hover:border-gray-200 focus-within:border-black focus-within:ring-2 focus-within:ring-[#d4ff00]'}`}>
        <div className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm" style={{ background: dotColor }}></div>
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} disabled={disabled} className="w-full bg-transparent ml-3 outline-none text-[15px] font-bold text-gray-900 placeholder-gray-400" />
      </div>
      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-3xl z-[1000] overflow-hidden p-2">
          {results.map(r => (
            <div key={r.place_id} onClick={() => { setQuery(r.display_name); setResults([]); onSelect({ address: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) }); }} className="p-3 px-4 rounded-2xl hover:bg-gray-50 cursor-pointer text-[13px] font-bold text-gray-800 leading-snug transition-colors">{r.display_name}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// NEON TIME PICKER MODAL
// =========================================================================
function NeonTimePickerModal({ isOpen, onClose, onSelect, initialTime }) {
    const [mode, setMode] = useState('hour'); 
    const [hour, setHour] = useState(7);
    const [minute, setMinute] = useState(0);
    const [ampm, setAmpm] = useState('AM');

    useEffect(() => {
        if (isOpen && initialTime) {
            const [h, m] = initialTime.split(':').map(Number);
            if (!isNaN(h)) {
                setHour(h % 12 === 0 ? 12 : h % 12);
                setAmpm(h >= 12 ? 'PM' : 'AM');
            }
            if (!isNaN(m)) setMinute(m);
        }
    }, [isOpen, initialTime]);

    if (!isOpen) return null;

    const handleNumberClick = (val) => {
        if (mode === 'hour') {
            setHour(val === 0 ? 12 : val);
            setTimeout(() => setMode('minute'), 300);
        } else {
            setMinute(val);
        }
    };

    const generatePositions = (isHour) => {
        const items = [];
        for(let i=0; i<12; i++) {
            const val = isHour ? (i === 0 ? 12 : i) : i * 5;
            const angle = (i * 30 - 90) * (Math.PI / 180);
            const r = 96;
            items.push({
                val,
                left: 128 + r * Math.cos(angle),
                top: 128 + r * Math.sin(angle)
            });
        }
        return items;
    };

    const activeVal = mode === 'hour' ? hour : minute;
    let activeAngle = mode === 'hour' ? (hour === 12 ? 0 : hour) * 30 - 90 : (minute / 5) * 30 - 90;
    const lineX = 128 + 96 * Math.cos(activeAngle * Math.PI / 180);
    const lineY = 128 + 96 * Math.sin(activeAngle * Math.PI / 180);

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="bg-white rounded-[36px] p-8 w-full max-w-[340px] shadow-[0_20px_60px_rgb(0,0,0,0.3)] font-sans">
                <h2 className="text-[14px] font-extrabold text-gray-400 mb-6 tracking-wider uppercase text-center">Wybierz Godzinę</h2>
                
                <div className="flex justify-center items-center gap-3 mb-10">
                    <div onClick={() => setMode('hour')} className={`w-24 h-24 rounded-3xl flex items-center justify-center text-[44px] font-black cursor-pointer transition-all ${mode === 'hour' ? 'bg-[#d4ff00] text-black shadow-lg scale-105' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                        {hour.toString().padStart(2, '0')}
                    </div>
                    <span className="text-4xl font-black text-gray-300 pb-2">:</span>
                    <div onClick={() => setMode('minute')} className={`w-24 h-24 rounded-3xl flex items-center justify-center text-[44px] font-black cursor-pointer transition-all ${mode === 'minute' ? 'bg-[#d4ff00] text-black shadow-lg scale-105' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                        {minute.toString().padStart(2, '0')}
                    </div>
                    <div className="flex flex-col bg-gray-50 rounded-2xl overflow-hidden ml-2 p-1 gap-1">
                        <div onClick={() => setAmpm('AM')} className={`px-4 py-2 text-[14px] font-black rounded-xl cursor-pointer transition-colors ${ampm==='AM' ? 'bg-black text-white shadow-md' : 'bg-transparent text-gray-400'}`}>AM</div>
                        <div onClick={() => setAmpm('PM')} className={`px-4 py-2 text-[14px] font-black rounded-xl cursor-pointer transition-colors ${ampm==='PM' ? 'bg-black text-white shadow-md' : 'bg-transparent text-gray-400'}`}>PM</div>
                    </div>
                </div>

                <div className="relative w-[256px] h-[256px] mx-auto bg-gray-50 rounded-full border border-gray-100 shadow-inner">
                    <div className="absolute left-[122px] top-[122px] w-3 h-3 bg-black rounded-full z-10 shadow-sm"></div>
                    <svg className="absolute inset-0 pointer-events-none" width="256" height="256">
                        <line x1="128" y1="128" x2={lineX} y2={lineY} stroke="black" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <div className="absolute w-12 h-12 bg-[#d4ff00] rounded-full pointer-events-none transition-all shadow-md" style={{ left: lineX - 24, top: lineY - 24 }}></div>

                    {generatePositions(mode === 'hour').map((pos, i) => (
                        <div key={i} onClick={() => handleNumberClick(pos.val)} className={`absolute w-12 h-12 flex items-center justify-center text-[16px] font-black cursor-pointer rounded-full transition-colors z-20 ${activeVal === pos.val ? 'text-black' : 'text-gray-500 hover:bg-black/5'}`} style={{ left: pos.left - 24, top: pos.top - 24 }}>
                            {pos.val}
                        </div>
                    ))}
                </div>

                <div className="flex justify-between items-center mt-10">
                    <button onClick={onClose} className="px-6 py-3 text-[15px] font-bold text-gray-400 hover:text-black transition-colors">Anuluj</button>
                    <button onClick={() => {
                        let h = hour;
                        if (ampm === 'PM' && h < 12) h += 12;
                        if (ampm === 'AM' && h === 12) h = 0;
                        onSelect(`${h.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}`);
                        onClose();
                    }} className="px-8 py-3 text-[15px] font-black text-white bg-black hover:bg-gray-800 rounded-full transition-colors shadow-xl">Zatwierdź</button>
                </div>
            </div>
        </div>
    );
}
// =========================================================================

function ActiveRideCard({ booking, onCancel, onAccept, onReject, isArchived }) {
  const [minutesLeft, setMinutesLeft] = useState(null);

  useEffect(() => {
    if (!booking || booking.status !== 'scheduled' || !booking.pickupTimestamp) return;
    const updateCountdown = () => {
      const diff = booking.pickupTimestamp - Date.now();
      const mins = Math.max(0, Math.ceil(diff / 60000));
      setMinutesLeft(mins);
    };
    updateCountdown();
    const inv = setInterval(updateCountdown, 10000); 
    return () => clearInterval(inv);
  }, [booking]);

  const renderSmallMap = () => {
    if (!booking.pickupCoords || !booking.dropoffCoords) return null;
    const bounds = L.latLngBounds([
        [50.0679, 19.9475], // MDA
        [booking.pickupCoords.lat, booking.pickupCoords.lng],
        [booking.dropoffCoords.lat, booking.dropoffCoords.lng]
    ]);
    if (booking.originalDropoffCoords) bounds.extend([booking.originalDropoffCoords.lat, booking.originalDropoffCoords.lng]);

    return (
        <div className={`h-48 w-full rounded-3xl overflow-hidden mt-4 mb-5 border border-gray-100 relative z-0 ${isArchived ? 'opacity-50 grayscale' : 'shadow-sm'}`}>
            <MapContainer center={[50.06, 19.94]} zoom={13} zoomControl={false} scrollWheelZoom={false} style={{height: '100%', width: '100%'}}>
                <FitBounds bounds={bounds} />
                <TileLayer url={MAP_TILES} attribution="&copy; CARTO" />
                {booking.routeGeojson && <GeoJSON data={booking.routeGeojson} style={{color: '#111827', weight: 4, dashArray: '6, 10', lineJoin: 'round', lineCap: 'round'}} />}
                
                <Marker position={[50.0679, 19.9475]} icon={PIN_BASE} />
                <Marker position={[booking.pickupCoords.lat, booking.pickupCoords.lng]} icon={PIN_PICKUP} />
                
                {booking.walkDistance && booking.originalDropoffCoords ? (
                    <>
                       <Marker position={[booking.dropoffCoords.lat, booking.dropoffCoords.lng]} icon={PIN_WALK} /> 
                       <Polyline positions={[
                           [booking.dropoffCoords.lat, booking.dropoffCoords.lng],
                           [booking.originalDropoffCoords.lat, booking.originalDropoffCoords.lng]
                       ]} pathOptions={{color: '#9ca3af', dashArray: '4, 8', weight: 4, lineJoin: 'round', lineCap: 'round'}} />
                       <Marker position={[booking.originalDropoffCoords.lat, booking.originalDropoffCoords.lng]} icon={PIN_DROPOFF} /> 
                    </>
                ) : (
                   <Marker position={[booking.dropoffCoords.lat, booking.dropoffCoords.lng]} icon={PIN_DROPOFF} />
                )}
            </MapContainer>
        </div>
    );
  };

  if (isArchived) {
    return (
      <div className="bg-white rounded-[32px] shadow-sm p-6 border border-gray-100 mb-6 text-left opacity-80">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><History className="w-5 h-5 text-gray-400"/><span className="font-extrabold text-gray-900">Archiwum</span></div>
          <div className="bg-gray-100 text-gray-500 text-[11px] font-mono px-3 py-1.5 rounded-full font-bold">{booking.status === 'rejected' ? 'ODRZUCONY' : 'ZAKOŃCZONY'}</div>
        </div>
        {booking.status === 'rejected' ? (
           <p className="text-[13px] text-gray-500 font-medium my-2">Odrzuciłeś ofertę na ten przejazd.</p>
        ) : (
           <>
              {renderSmallMap()}
              <div className="flex justify-between items-center text-sm mt-2 font-bold">
                 <div className="text-gray-500 line-clamp-1 flex-1 pr-2 truncate">{booking.pickupLocation}</div>
                 <div className="text-gray-900 bg-gray-100 px-3 py-1 rounded-full">{booking.price}</div>
              </div>
           </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[36px] shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-6 border border-gray-100 mb-6 text-left relative overflow-hidden">
      
      {booking.status === 'pending' && (
        <div className="flex flex-col items-center py-8">
          <div className="w-16 h-16 bg-[#d4ff00] rounded-full flex items-center justify-center mb-5 animate-pulse shadow-lg">
             <Loader2 className="w-8 h-8 text-black animate-spin" />
          </div>
          <h3 className="text-[18px] font-extrabold text-black">Szukanie trasy...</h3>
          <p className="text-[13px] text-gray-500 text-center mt-2 font-medium px-4">Algorytm klastrowania VRP dobiera idealnych pasażerów z Twojej okolicy.</p>
          <button onClick={() => onCancel(booking.id)} className="mt-8 flex items-center justify-center gap-2 w-full py-4 text-[15px] text-gray-500 font-bold hover:text-black transition-colors rounded-full bg-gray-50 hover:bg-gray-100">
            Anuluj zgłoszenie
          </button>
        </div>
      )}

      {booking.status === 'offered' && (
        <div className="flex flex-col py-2">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4ff00] opacity-20 rounded-bl-[100px] pointer-events-none"></div>
          
          <div className="flex items-center gap-3 mb-3 relative z-10">
             <div className="w-10 h-10 bg-black text-[#d4ff00] rounded-full flex items-center justify-center text-xl shadow-lg">⚡</div>
             <h3 className="text-[20px] font-extrabold text-black">Opcja Przejazdu</h3>
          </div>
          <p className="text-[13px] text-gray-500 font-semibold mb-2">Znaleziono optymalne połączenie:</p>
          
          {renderSmallMap()}
          
          <div className="bg-gray-50 border border-gray-100 rounded-3xl p-5 space-y-4 mb-6">
             <div className="flex justify-between items-center"><span className="text-[12px] text-gray-500 font-extrabold uppercase">Czas odbioru</span><span className="text-[18px] font-black text-black">{booking.pickupEta}</span></div>
             <div className="h-px w-full bg-gray-200"></div>
             <div className="flex justify-between items-center">
                 <span className="text-[12px] text-gray-500 font-extrabold uppercase">Całkowity Koszt</span>
                 <span className="text-[18px] font-black text-black bg-[#d4ff00] px-3 py-1 rounded-full">
                     {booking.originalPrice && <span className="line-through text-gray-500 text-[14px] mr-2">{booking.originalPrice}</span>}
                     {booking.price}
                 </span>
             </div>
             
             {booking.walkDistance && (
               <div className="mt-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                  <p className="text-[12px] font-extrabold text-black mb-1.5 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Wirtualny Przystanek</p>
                  <p className="text-[12px] text-gray-500 font-medium leading-relaxed">{booking.virtualStopReason || `Aby trasa była dla Ciebie tania, bus wysadzi Cię wcześniej. Należy dojść pieszo ${booking.walkDistance}m do samego celu.`}</p>
               </div>
             )}
          </div>
          
          <div className="flex gap-3">
             <button onClick={() => onReject(booking.id)} className="flex-1 py-4 text-[14px] font-extrabold text-gray-500 bg-gray-100 hover:bg-gray-200 hover:text-black rounded-full transition-colors">Odrzuć</button>
             <button onClick={() => onAccept(booking.id)} className="flex-[2] py-4 text-[15px] font-black text-black bg-[#d4ff00] hover:bg-[#c2ed00] rounded-full transition-colors shadow-lg">Akceptuj Bilet</button>
          </div>
        </div>
      )}

      {(booking.status === 'scheduled' || booking.status === 'no_show') && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
               <div className={`w-10 h-10 ${booking.status === 'no_show' ? 'bg-red-500 text-white' : 'bg-black text-[#d4ff00]'} rounded-full flex items-center justify-center shadow-lg`}><CheckCircle2 className="w-6 h-6"/></div>
               <span className={`font-extrabold text-[18px] ${booking.status === 'no_show' ? 'text-red-500' : 'text-black'}`}>{booking.status === 'no_show' ? 'Bilet Zablokowany' : 'Bilet Aktywny'}</span>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-xl" title="Profil pasażera">{booking.profile === 'senior' ? '🧓' : (booking.profile === 'student' ? '🎒' : '👤')}</span>
               <div className="bg-gray-100 text-gray-500 text-[11px] font-mono px-3 py-1.5 rounded-full font-bold">#{booking.id.slice(0,5).toUpperCase()}</div>
            </div>
          </div>
          
          {minutesLeft !== null && (
            <div className="bg-[#d4ff00] rounded-[28px] p-6 text-center mt-5 mb-2 shadow-sm border border-[#c2ed00]">
              <span className="text-[13px] font-extrabold text-black uppercase tracking-wider">Bus odjedzie za:</span>
              <div className="text-[44px] font-black text-black leading-none my-2">{minutesLeft} <span className="text-xl">min</span></div>
              <span className="text-[12px] text-black/70 font-bold">Bądź na miejscu zbiórki o {booking.pickupEta}</span>
            </div>
          )}
          
          {renderSmallMap()}
          
          <div className="bg-gray-50 rounded-[28px] p-5 space-y-4 border border-gray-100">
            <div>
              <p className="text-[11px] font-extrabold text-gray-400 uppercase mb-1">Odbiór</p>
              <p className="text-[14px] font-bold text-gray-900 leading-snug">{booking.pickupLocation}</p>
            </div>
            <div className="h-px w-full bg-gray-200"></div>
            <div>
              <p className="text-[11px] font-extrabold text-gray-400 uppercase mb-1">Wysiadka</p>
              <p className="text-[14px] font-bold text-gray-900 leading-snug">{booking.dropoffLocation}</p>
            </div>
            <div className="h-px w-full bg-gray-200"></div>
            <div className="flex justify-between items-center pt-1">
               <div>
                 <p className="text-[11px] font-extrabold text-gray-400 uppercase mb-1">Opłacono</p>
                 <p className="text-[16px] font-black bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100 inline-block">
                    {booking.originalPrice && <span className="line-through text-gray-400 text-[12px] mr-2">{booking.originalPrice}</span>}
                    {booking.price}
                 </p>
               </div>
               <div className="text-right"><p className="text-[11px] font-extrabold text-gray-400 uppercase mb-1">U celu</p><p className="text-[18px] font-black text-black">{booking.dropoffEta}</p></div>
            </div>
            
            {booking.walkDistance && (
              <div className="mt-2 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                 <p className="text-[12px] font-extrabold text-black mb-1.5 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Wirtualny Przystanek</p>
                 <p className="text-[12px] text-gray-500 font-medium leading-relaxed">{booking.virtualStopReason || `Pozostało ${booking.walkDistance}m dojścia pieszego z punktu zrzutu do ostatecznego celu (ok. ${Math.ceil(booking.walkDistance / 80)} min).`}</p>
              </div>
            )}
          </div>

          <div className="mt-5 p-5 bg-white border-2 border-gray-100 rounded-[28px] text-center shadow-sm relative overflow-hidden">
             {booking.scanned ? (
                <div className="py-6 flex flex-col items-center gap-2">
                   <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white text-3xl shadow-lg mb-2">✓</div>
                   <p className="font-black text-[18px] text-gray-900">Bilet Zeskanowany!</p>
                   <p className="text-[13px] text-gray-500 font-bold">Życzymy miłej podróży.</p>
                </div>
             ) : booking.status === 'no_show' ? (
                <div className="py-6 flex flex-col items-center gap-2">
                   <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 text-3xl shadow-sm mb-2">✗</div>
                   <p className="font-black text-[18px] text-gray-900">Nie stawiłeś/aś się</p>
                   <p className="text-[13px] text-red-500 font-bold">Trasa została zoptymalizowana.</p>
                </div>
             ) : (
                <>
                   <p className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest mb-4">Twój bilet cyfrowy</p>
                   <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=SMARTLINK-${booking.id}`} alt="QR Code" className="mx-auto w-[120px] h-[120px] rounded-lg mb-3 mix-blend-multiply" />
                   <div className="bg-gray-100 font-mono text-[18px] font-black tracking-[0.3em] py-2 px-4 rounded-xl inline-block mb-5">{booking.id.substring(0, 6).toUpperCase()}</div>
                   
                   <button onClick={async () => { await fetch(`/api/booking/${booking.id}/scan`, {method:'POST'}); onAccept(); }} className="w-full bg-black text-[#d4ff00] hover:bg-gray-800 text-[14px] font-bold py-3.5 rounded-full transition-colors shadow-lg flex items-center justify-center gap-2">
                      🎫 Symuluj Skanowanie w Busie
                   </button>
                </>
             )}
          </div>
          
          {(!booking.scanned && booking.status !== 'no_show') && (
            <button onClick={() => onCancel(booking.id)} className="w-full mt-6 flex items-center justify-center gap-2 text-[14px] text-gray-500 font-bold bg-transparent hover:text-red-500 py-3 rounded-full transition-colors">
              Zrezygnuj z przejazdu
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [userId] = useState(() => {
    let id = localStorage.getItem('sv_userId');
    if(!id) { id = crypto.randomUUID(); localStorage.setItem('sv_userId', id); }
    return id;
  });

  const [activeTab, setActiveTab] = useState('new'); 
  const [myBookings, setMyBookings] = useState([]);
  
  const [pickup,  setPickup]  = useState({ address: "", lat: null, lng: null });
  const [dropoff, setDropoff] = useState({ address: "", lat: null, lng: null });
  const [passengers, setPassengers] = useState("1");
  const [arrivalDate, setArrivalDate] = useState("Dzień 1");
  const [arrivalTime, setArrivalTime] = useState("ASAP");
  const [mapMode, setMapMode] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);

  const isFormValid = pickup.address !== "" && dropoff.address !== "";

  const fetchMyBookings = useCallback(async () => {
    try {
      const res = await fetch(`/api/user-bookings/${userId}`);
      const data = await res.json();
      setMyBookings(data);
    } catch(e) {}
  }, [userId]);

  useEffect(() => {
    fetchMyBookings();
    const interval = setInterval(fetchMyBookings, 3000);
    return () => clearInterval(interval);
  }, [fetchMyBookings]);

  const handleMapClick = useCallback(({ lat, lng, address }) => {
    if (mapMode === "pickup")  setPickup({ address, lat, lng });
    else if (mapMode === "dropoff") setDropoff({ address, lat, lng });
    setMapMode(null);
  }, [mapMode]);

  const [userProfile, setUserProfile] = useState(() => localStorage.getItem('sv_userProfile') || 'adult');
  const [wheelchair, setWheelchair] = useState(() => localStorage.getItem('sv_wheelchair') === 'true');

  const saveSettings = (profile, wchair) => {
      setUserProfile(profile);
      setWheelchair(wchair);
      localStorage.setItem('sv_userProfile', profile);
      localStorage.setItem('sv_wheelchair', wchair);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setIsLoading(true);
    const payload = {
      userId,
      pickupLocation: pickup.address, pickupCoords: { lat: pickup.lat, lng: pickup.lng },
      dropoffLocation: dropoff.address, dropoffCoords: { lat: dropoff.lat, lng: dropoff.lng },
      passengers: parseInt(passengers), arrivalDate, arrivalTime, wheelchair,
      profile: userProfile, purpose: "Inne"
    };
    try {
      await fetch("/api/book-ride", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setPickup({ address: "", lat: null, lng: null });
      setDropoff({ address: "", lat: null, lng: null });
      setWheelchair(false);
      setActiveTab('rides');
      fetchMyBookings();
    } catch (err) { alert("Błąd połączenia"); }
    finally { setIsLoading(false); }
  }

  async function handleCancel(id) { try { await fetch(`/api/booking/${id}`, { method: 'DELETE' }); fetchMyBookings(); } catch(e) {} }
  async function handleAccept(id) { try { await fetch(`/api/booking/${id}/accept`, { method: 'POST' }); fetchMyBookings(); } catch(e) {} }
  async function handleReject(id) { try { await fetch(`/api/booking/${id}/reject`, { method: 'POST' }); fetchMyBookings(); } catch(e) {} }

  const handleAutoFill = () => {
    const locs = [
       { a: "Rynek Główny", lat: 50.0614, lng: 19.9365 },
       { a: "TAURON Arena", lat: 50.0682, lng: 19.9912 },
       { a: "Wawel", lat: 50.0540, lng: 19.9354 },
       { a: "AGH", lat: 50.0655, lng: 19.9174 },
       { a: "Kazimierz", lat: 50.0518, lng: 19.9452 },
       { a: "Plac Centralny (NH)", lat: 50.072, lng: 20.038 },
       { a: "Kurdwanów", lat: 50.007, lng: 19.944 },
       { a: "Rondo Ofiar Katynia", lat: 50.088, lng: 19.890 },
       { a: "Kampus UJ (Ruczaj)", lat: 50.027, lng: 19.900 },
       { a: "Górka Narodowa", lat: 50.104, lng: 19.948 },
       { a: "Bieżanów", lat: 50.015, lng: 20.017 },
       { a: "Mistrzejowice", lat: 50.100, lng: 20.000 },
       { a: "Lotnisko Balice", lat: 50.077, lng: 19.784 },
       { a: "Skawina (Centrum)", lat: 49.975, lng: 19.828 },
       { a: "Wieliczka (Kopalnia)", lat: 49.983, lng: 20.052 },
       { a: "Zielonki", lat: 50.118, lng: 19.938 },
       { a: "Zabierzów", lat: 50.116, lng: 19.794 },
       { a: "Niepołomice", lat: 50.033, lng: 20.216 }
    ];
    let p1 = locs[Math.floor(Math.random() * locs.length)];
    let p2 = locs[Math.floor(Math.random() * locs.length)];
    while(p1 === p2) p2 = locs[Math.floor(Math.random() * locs.length)];

    setPickup({ address: p1.a, lat: p1.lat, lng: p1.lng });
    setDropoff({ address: p2.a, lat: p2.lat, lng: p2.lng });
    setPassengers(Math.floor(Math.random()*3)+1 + "");
    setWheelchair(Math.random() < 0.2);
  };

  const completedRides = myBookings.filter(b => b.status === 'rejected' || (b.status === 'scheduled' && Date.now() > b.dropoffTimestamp));
  const activeRides = myBookings.filter(b => !completedRides.includes(b));

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#111827] pb-12 font-sans relative">
      <style>{`
         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
         * { font-family: 'Plus Jakarta Sans', sans-serif; }
         .leaflet-div-icon { background: transparent; border: none; }
         .no-scrollbar::-webkit-scrollbar { display: none; }
         .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      
      <header className="sticky top-0 z-[9999] px-6 pt-5 pb-4 bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-sm rounded-b-[32px] mb-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center shadow-lg"><Bus className="w-6 h-6 text-[#d4ff00]" /></div>
          <div><h1 className="text-[22px] font-extrabold tracking-tight leading-none mb-1">SmartLink</h1><p className="text-[13px] text-gray-500 font-semibold">Pasażer Kraków</p></div>
        </div>
        
        <div className="flex bg-gray-50 p-1.5 rounded-full border border-gray-100 shadow-inner relative">
          <button onClick={() => setActiveTab('new')} className={`flex-1 py-3 text-[14px] font-bold rounded-full transition-all z-10 ${activeTab === 'new' ? 'bg-white shadow-[0_4px_12px_rgb(0,0,0,0.08)] text-black' : 'text-gray-400 hover:text-black'}`}>Przejazd</button>
          <button onClick={() => setActiveTab('rides')} className={`flex-1 py-3 text-[14px] font-bold rounded-full transition-all z-10 flex items-center justify-center gap-2 ${activeTab === 'rides' ? 'bg-white shadow-[0_4px_12px_rgb(0,0,0,0.08)] text-black' : 'text-gray-400 hover:text-black'}`}>
             Bilety {activeRides.length > 0 && <span className="bg-[#d4ff00] text-black px-2 py-0.5 rounded-full text-[11px] font-black">{activeRides.length}</span>}
          </button>
          <button onClick={() => setActiveTab('settings')} className={`flex-1 py-3 text-[14px] font-bold rounded-full transition-all z-10 ${activeTab === 'settings' ? 'bg-white shadow-[0_4px_12px_rgb(0,0,0,0.08)] text-black' : 'text-gray-400 hover:text-black'}`}>Konto</button>
        </div>
      </header>

      {/* ════ MOJE PRZEJAZDY ════ */}
      {activeTab === 'rides' && (
        <main className="max-w-xl mx-auto px-5">
          {activeRides.length === 0 && completedRides.length === 0 ? (
            <div className="text-center text-gray-400 mt-24 flex flex-col items-center"><div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4"><Bus className="w-8 h-8 opacity-40" /></div><p className="font-bold text-[15px]">Brak aktywnych przejazdów.</p></div>
          ) : (
            <>
              {activeRides.map(b => <ActiveRideCard key={b.id} booking={b} onCancel={handleCancel} onAccept={handleAccept} onReject={handleReject} isArchived={false} />)}
              
              {completedRides.length > 0 && (
                 <div className="mt-12">
                    <h2 className="text-[13px] font-extrabold text-gray-400 uppercase tracking-widest mb-6 px-4">Zakończone Trasy</h2>
                    {completedRides.map(b => <ActiveRideCard key={b.id} booking={b} isArchived={true} />)}
                 </div>
              )}
            </>
          )}
        </main>
      )}

      {/* ════ NOWY PRZEJAZD ════ */}
      {activeTab === 'new' && (
        <main className="max-w-xl mx-auto px-5 space-y-6">
          
          <section className="bg-white rounded-[36px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.05)] border border-gray-100 relative">
             <div className="absolute top-4 left-4 right-4 z-[500] flex gap-2">
                <div className="flex-1">
                   <div className="bg-white rounded-full p-1.5 flex gap-1.5 shadow-lg border border-gray-100">
                     <button type="button" onClick={() => setMapMode(m => m === 'pickup' ? null : 'pickup')} className={`flex-1 py-2.5 rounded-full text-[13px] font-extrabold transition-all ${mapMode === 'pickup' ? 'bg-[#d4ff00] text-black shadow-md' : pickup.lat ? 'bg-gray-100 text-black' : 'hover:bg-gray-50'}`}>{mapMode === 'pickup' ? 'Wskazujesz...' : 'Odjazd'}</button>
                     <button type="button" onClick={() => setMapMode(m => m === 'dropoff' ? null : 'dropoff')} className={`flex-1 py-2.5 rounded-full text-[13px] font-extrabold transition-all ${mapMode === 'dropoff' ? 'bg-black text-[#d4ff00] shadow-md' : dropoff.lat ? 'bg-gray-100 text-black' : 'hover:bg-gray-50'}`}>{mapMode === 'dropoff' ? 'Wskazujesz...' : 'Cel'}</button>
                   </div>
                </div>
             </div>
             
             {mapMode && <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[400] bg-black/80 backdrop-blur-sm text-white px-5 py-2.5 rounded-full text-[12px] font-bold shadow-xl flex items-center gap-2 pointer-events-none"><Crosshair className="w-4 h-4 text-[#d4ff00]" /> Wybierz punkt na mapie</div>}
             
             <div className="h-[340px] w-full z-0 bg-[#f4f4f4]">
                <MapContainer center={[50.064, 19.945]} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false} className={mapMode ? "cursor-crosshair" : ""}>
                   <TileLayer url={MAP_TILES} attribution="&copy; OpenStreetMap" />
                   <MapClickHandler onMapClick={handleMapClick} active={!!mapMode} />
                   {pickup.lat && <Marker position={[pickup.lat, pickup.lng]} icon={PIN_PICKUP} />}
                   {dropoff.lat && <Marker position={[dropoff.lat, dropoff.lng]} icon={PIN_DROPOFF} />}
                </MapContainer>
             </div>
          </section>

          <section className="bg-white rounded-[36px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)] border border-gray-100 space-y-4">
            <AddressSearch label="Zabierz mnie z" dotColor="#d4ff00" value={pickup.address} onSelect={setPickup} placeholder="Wybierz punkt startu..." disabled={isLoading} />
            <AddressSearch label="Zawieź mnie do" dotColor="#000000" value={dropoff.address} onSelect={setDropoff} placeholder="Dokąd jedziemy?" disabled={isLoading} />
          </section>

          <section className="bg-white rounded-[36px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)] border border-gray-100 space-y-6">
             <div>
                <label className="block text-[11px] font-extrabold text-gray-400 uppercase tracking-wider mb-3">Data Podróży (max 2 dni w przód)</label>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                   {['Dzień 1', 'Dzień 2', 'Dzień 3'].map(d => (
                       <button type="button" key={d} onClick={() => setArrivalDate(d)} className={`px-6 py-3.5 rounded-full text-[14px] font-extrabold whitespace-nowrap transition-all flex-1 ${arrivalDate === d ? 'bg-black text-[#d4ff00] shadow-lg' : 'bg-gray-50 border border-gray-100 text-gray-400 hover:bg-gray-100 hover:text-black'}`}>{d}</button>
                   ))}
                </div>
             </div>
             
             <div>
                <label className="block text-[11px] font-extrabold text-gray-400 uppercase tracking-wider mb-3">Czas Wyjazdu</label>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                   {['ASAP', 'Za 30 min', 'Własny...'].map(t => (
                       <button type="button" key={t} onClick={() => {
                           if(t === 'Własny...') setIsTimePickerOpen(true);
                           else setArrivalTime(t);
                       }} className={`px-6 py-3.5 rounded-full text-[14px] font-extrabold whitespace-nowrap transition-all ${arrivalTime === t || (t === 'Własny...' && arrivalTime !== 'ASAP' && arrivalTime !== 'Za 30 min' && arrivalTime !== '') ? 'bg-[#d4ff00] text-black shadow-lg' : 'bg-gray-50 border border-gray-100 text-gray-400 hover:bg-gray-100 hover:text-black'}`}>
                          {t === 'Własny...' && arrivalTime !== 'ASAP' && arrivalTime !== 'Za 30 min' && arrivalTime !== '' ? arrivalTime : t}
                       </button>
                   ))}
                </div>
             </div>
             
             <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-[28px] p-4">
                   <div className="flex items-center gap-3 font-extrabold text-gray-900 text-[14px]">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100"><User className="w-5 h-5 text-black" /></div>
                      Pasażerowie
                   </div>
                   <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-full p-1 shadow-sm">
                      <button type="button" onClick={() => setPassengers(String(Math.max(1, parseInt(passengers) - 1)))} className="w-10 h-10 rounded-full bg-gray-50 text-gray-400 font-black text-xl hover:bg-gray-100 flex items-center justify-center pb-1 hover:text-black transition-colors">-</button>
                      <span className="font-black text-[15px] w-4 text-center text-black">{passengers}</span>
                      <button type="button" onClick={() => setPassengers(String(Math.min(10, parseInt(passengers) + 1)))} className="w-10 h-10 rounded-full bg-[#d4ff00] text-black font-black text-[22px] flex items-center justify-center pb-1 shadow-sm hover:bg-[#c2ed00] transition-colors">+</button>
                   </div>
                </div>
                
             </div>
          </section>

          <div className="pt-4 flex flex-col gap-4">
            <button type="button" onClick={handleAutoFill} className="w-full py-4 rounded-full text-[14px] font-extrabold bg-transparent text-gray-400 border-2 border-gray-200 hover:border-gray-300 hover:text-black transition-colors">
              Uzupełnij przykładowo
            </button>
            <button onClick={handleSubmit} disabled={!isFormValid || isLoading} className="w-full py-5 rounded-full text-[16px] font-black bg-black text-[#d4ff00] hover:bg-gray-800 disabled:opacity-50 transition-all shadow-xl flex items-center justify-center gap-3">
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-[#d4ff00]" /> : "Zamów przejazd"}
            </button>
          </div>
        </main>
      )}

      {/* ════ USTAWIENIA KONTA ════ */}
      {activeTab === 'settings' && (
        <main className="max-w-xl mx-auto px-5 space-y-6">
          <section className="bg-white rounded-[36px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)] border border-gray-100">
             <h2 className="text-[18px] font-black text-black mb-6">Ustawienia Profilu</h2>
             
             <div className="space-y-4 mb-8">
               <label className="block text-[11px] font-extrabold text-gray-400 uppercase tracking-wider mb-3">Wybierz profil zniżkowy</label>
               
               <div onClick={() => saveSettings('adult', wheelchair)} className={`p-4 rounded-2xl border-2 transition-colors cursor-pointer flex items-center justify-between ${userProfile === 'adult' ? 'border-[#d4ff00] bg-[#faffd6]' : 'border-gray-100 hover:border-gray-200'}`}>
                 <div className="flex items-center gap-3">
                   <div className="text-2xl">👤</div>
                   <div>
                     <p className="font-bold text-[15px] text-gray-900">Standardowy (Dorosły)</p>
                     <p className="text-[12px] text-gray-500">Zgoda na spacery do 800m za zniżki</p>
                   </div>
                 </div>
                 {userProfile === 'adult' && <CheckCircle2 className="text-[#d4ff00] w-6 h-6" />}
               </div>
               
               <div onClick={() => saveSettings('student', wheelchair)} className={`p-4 rounded-2xl border-2 transition-colors cursor-pointer flex items-center justify-between ${userProfile === 'student' ? 'border-[#d4ff00] bg-[#faffd6]' : 'border-gray-100 hover:border-gray-200'}`}>
                 <div className="flex items-center gap-3">
                   <div className="text-2xl">🎒</div>
                   <div>
                     <p className="font-bold text-[15px] text-gray-900">Uczeń / Dziecko</p>
                     <p className="text-[12px] text-gray-500">Bezpieczne ścieżki piesze max 300m</p>
                   </div>
                 </div>
                 {userProfile === 'student' && <CheckCircle2 className="text-[#d4ff00] w-6 h-6" />}
               </div>

               <div onClick={() => saveSettings('senior', wheelchair)} className={`p-4 rounded-2xl border-2 transition-colors cursor-pointer flex items-center justify-between ${userProfile === 'senior' ? 'border-[#d4ff00] bg-[#faffd6]' : 'border-gray-100 hover:border-gray-200'}`}>
                 <div className="flex items-center gap-3">
                   <div className="text-2xl">🧓</div>
                   <div>
                     <p className="font-bold text-[15px] text-gray-900">Senior (65+)</p>
                     <p className="text-[12px] text-gray-500">Brak wirtualnych przystanków (Door-to-door)</p>
                   </div>
                 </div>
                 {userProfile === 'senior' && <CheckCircle2 className="text-[#d4ff00] w-6 h-6" />}
               </div>
             </div>

             <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-[28px] p-4 cursor-pointer" onClick={() => saveSettings(userProfile, !wheelchair)}>
                 <div className="flex items-center gap-3 font-extrabold text-gray-900 text-[14px]">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 text-[20px]">♿</div>
                    <div>
                      <p>Wózek Inwalidzki</p>
                      <p className="text-[11px] font-medium text-gray-500">Traktowane priorytetowo jak Senior</p>
                    </div>
                 </div>
                 <div className={`w-14 h-8 rounded-full p-1 flex transition-colors ${wheelchair ? 'bg-black' : 'bg-gray-200'}`}>
                    <div className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${wheelchair ? 'translate-x-6' : 'translate-x-0'}`}></div>
                 </div>
             </div>
          </section>
        </main>
      )}

      <NeonTimePickerModal isOpen={isTimePickerOpen} onClose={() => setIsTimePickerOpen(false)} onSelect={(t) => setArrivalTime(t)} initialTime={arrivalTime} />
    </div>
  );
}
