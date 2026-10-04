import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

let bookings = [];
let globalRoutes = [];
const MDA_COORDS = { lat: 50.0679, lng: 19.9475 }; // Baza MDA Kraków

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

app.post('/api/book-ride', (req, res) => {
  const booking = {
    id: crypto.randomUUID(),
    ...req.body,
    status: 'pending',
    receivedAt: new Date().toISOString(),
    pickupEta: null, dropoffEta: null,
    pickupTimestamp: null, dropoffTimestamp: null,
    price: null, runId: null,
    walkDistance: null, 
    originalDropoffLocation: req.body.dropoffLocation,
    originalDropoffCoords: req.body.dropoffCoords
  };
  bookings.unshift(booking);
  res.status(201).json({ success: true, bookingId: booking.id });
});

app.get('/api/user-bookings/:userId', (req, res) => {
  const userB = bookings.filter(b => b.userId === req.params.userId);
  const enhanced = userB.map(b => {
    const route = globalRoutes.find(r => r.runId === b.runId);
    if (route) return { ...b, routeGeojson: route.geojson };
    return b;
  });
  res.json(enhanced);
});

app.get('/api/booking/:id', (req, res) => {
  const b = bookings.find(x => x.id === req.params.id);
  if (b) {
    const route = globalRoutes.find(r => r.runId === b.runId);
    if (route) b.routeGeojson = route.geojson;
    res.json(b);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.post('/api/booking/:id/scan', (req, res) => {
  const b = bookings.find(x => x.id === req.params.id);
  if (b) {
    b.scanned = true;
    res.json({ success: true, message: 'Bilet zeskanowany pomyślnie!' });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.post('/api/booking/:id/no-show', (req, res) => {
  const b = bookings.find(x => x.id === req.params.id);
  if (b) {
    b.status = 'no_show';
    b.noShowApplied = true; // Flaga dla frontendu
    
    // Przeliczenie trasy (Zysk dla reszty grupy)
    const route = globalRoutes.find(r => r.runId === b.runId);
    if (route) {
        // Skracamy czas zakończenia trasy o 6 minut (nie wjeżdżamy na dropoff tego pasażera)
        route.endTime -= (6 * 60000); 
    }
    res.json({ success: true, message: 'Oznaczono jako No-Show. Trasa zoptymalizowana.' });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.delete('/api/booking/:id', (req, res) => {
  const idx = bookings.findIndex(x => x.id === req.params.id);
  if (idx !== -1 && ['pending', 'offered', 'scheduled'].includes(bookings[idx].status)) {
    bookings.splice(idx, 1);
    return res.json({ success: true });
  }
  res.status(400).json({ error: 'Cannot cancel' });
});

app.post('/api/booking/:id/accept', (req, res) => {
  const b = bookings.find(x => x.id === req.params.id);
  if (b && b.status === 'offered') { b.status = 'scheduled'; return res.json({success: true}); }
  res.status(400).json({ error: 'Invalid state' });
});

app.post('/api/booking/:id/reject', (req, res) => {
  const b = bookings.find(x => x.id === req.params.id);
  if (b && b.status === 'offered') { b.status = 'rejected'; return res.json({success: true}); }
  res.status(400).json({ error: 'Invalid state' });
});

app.get('/api/bookings', (req, res) => {
  res.json({ bookings, routes: globalRoutes });
});

app.delete('/api/bookings', (req, res) => {
  bookings = [];
  globalRoutes = [];
  res.json({ success: true });
});

app.post('/api/calculate-route', async (req, res) => {
  const currentDayStr = req.body.currentDayStr || 'Dzień 1';
  const maxCapacity = req.body.maxCapacity || 10;
  
  let unassigned = bookings.filter(b => b.status === 'pending' && b.arrivalDate === currentDayStr).reverse();
  
  if (unassigned.length === 0) return res.json({ success: true, message: 'Brak nowych zgłoszeń na podany dzień.' });

  // Algorytm najbliższego sąsiada VRP
  function getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lng - p2.lng, 2));
  }

  let runsList = [];
  console.log(`Starting to cluster ${unassigned.length} unassigned bookings...`);
  let clusterIters = 0;
  while (unassigned.length > 0) {
    clusterIters++;
    if (clusterIters > 1000) { console.log('CLUSTER HANG'); break; }
    let currentRun = [unassigned.shift()]; 
    let currentPassCount = currentRun[0].passengers;

    while (unassigned.length > 0 && currentPassCount < maxCapacity) {
      let bestIdx = -1;
      let minDist = Infinity;
      let lastPoint = currentRun[currentRun.length - 1]; // Zmiana na ostatni punkt (prawdziwe Nearest Neighbor TSP)
      
      for (let i = 0; i < unassigned.length; i++) {
        let candidate = unassigned[i];
        if (currentPassCount + candidate.passengers <= maxCapacity) {
          let d = getDistance(lastPoint.pickupCoords, candidate.pickupCoords);
          // Ograniczenie strefy grupowania: bus dobiera pasażerów max 6km od poprzedniego
          if (d < minDist && d < 0.06) { minDist = d; bestIdx = i; }
        }
      }

      if (bestIdx !== -1) {
        let bestCandidate = unassigned[bestIdx];
        
        // NOWA REGUŁA OPTYMALIZACJI (Detour > 30%)
        let isHugeDetour = false;
        let detourRatio = 0;
        if (currentRun.length >= 1 && bestCandidate.passengers === 1) {
            let currentRouteLength = 0.05; 
            for(let j = 0; j < currentRun.length - 1; j++) {
                currentRouteLength += getDistance(currentRun[j].pickupCoords, currentRun[j+1].pickupCoords);
            }
            
            detourRatio = minDist / currentRouteLength;
            bestCandidate.detourRatioPercent = Math.round(detourRatio * 100);
            
            if (detourRatio > 0.30) {
                isHugeDetour = true;
            }
        } else {
            bestCandidate.detourRatioPercent = 0;
        }

        if (isHugeDetour) {
            let weatherModifier = (bestCandidate.weather === 'Deszcz' || bestCandidate.weather === 'Śnieg') ? 0.5 : 1.0;

            if (bestCandidate.profile === 'senior' || bestCandidate.wheelchair) {
                // Seniorzy / Niepełnosprawni (wózek): door-to-door. 
                isHugeDetour = false;
                bestCandidate.timeSaved = 0;
            } else if (bestCandidate.profile === 'student') {
                bestCandidate.virtualStopOffer = true;
                bestCandidate.walkDistance = Math.floor((Math.random() * 100 + 150) * weatherModifier); // skracamy w deszczu
                bestCandidate.virtualStopReason = `Ochrona Seniorów 🤝 Podejdź ${bestCandidate.walkDistance}m do głównej drogi (bezpieczny ciąg pieszy).`;
                bestCandidate.timeSaved = Math.round(detourRatio * 15 + Math.random() * 5); // Szacunek: 5-15 min
            } else {
                bestCandidate.virtualStopOffer = true;
                bestCandidate.walkDistance = Math.floor((Math.random() * 400 + 300) * weatherModifier); 
                bestCandidate.virtualStopReason = `Podejdź ${bestCandidate.walkDistance}m do węzła, by zaoszczędzić czas jadącym seniorom. W nagrodę otrzymujesz 30% zniżki! 🌿`;
                bestCandidate.discountMultiplier = 0.7; 
                bestCandidate.timeSaved = Math.round(detourRatio * 20 + Math.random() * 5); 
            }
        } else {
            bestCandidate.timeSaved = 0;
        }

        if (isHugeDetour) {
            bestCandidate.originalPickupLocation = bestCandidate.pickupLocation;
            bestCandidate.pickupLocation = "Węzeł Głównej Drogi (" + bestCandidate.pickupLocation.split(',')[0] + ")";
        }

        currentRun.push(bestCandidate);
        currentPassCount += bestCandidate.passengers;
        unassigned.splice(bestIdx, 1);
      } else {
        break; 
      }
    }
    runsList.push(currentRun);
  }

  // Ograniczenie floty - wyrusza tylko tyle busów na ile pozwala maxDispatch
  if (req.body.maxDispatch !== undefined && runsList.length > req.body.maxDispatch) {
      runsList = runsList.slice(0, req.body.maxDispatch);
  }

  let runCounter = Date.now();
  const hour = new Date().getHours();
  const trafficFactor = (hour >= 15 && hour <= 18) ? 1.5 : 1.0; 

  let idx = 0;
  for (const run of runsList) {
    idx++;
    const coords = [];
    
    // Dodaj bazę MDA jako pierwszy punkt
    coords.push(`${MDA_COORDS.lng},${MDA_COORDS.lat}`);

    run.forEach(b => {
      // Wirtualne Przystanki (Last Mile) - aplikowane, gdy autobus wioząc innych pasażerów musiałby zjechać w ciasne uliczki
      if (run.length > 1 && Math.random() > 0.3 && !b.walkDistance && b.originalDropoffCoords) {
        
        let weatherModifier = (b.weather === 'Deszcz' || b.weather === 'Śnieg') ? 0.5 : 1.0;
        
        if (b.profile === 'senior' || b.wheelchair) {
            // Brak wirtualnego przystanku dla seniorów
        } else if (b.profile === 'student') {
            b.walkDistance = Math.floor((Math.random() * 100 + 100) * weatherModifier); // max ~200m
            b.dropoffLocation = "Węzeł Wirtualny (" + b.originalDropoffLocation.split(',')[0] + ")";
            b.dropoffCoords = { lat: b.originalDropoffCoords.lat + 0.001, lng: b.originalDropoffCoords.lng + 0.001 };
        } else {
            b.walkDistance = Math.floor((Math.random() * 500 + 150) * weatherModifier); // 150-650m
            b.dropoffLocation = "Węzeł Wirtualny (" + b.originalDropoffLocation.split(',')[0] + ")";
            const latOffset = (Math.random() > 0.5 ? -1 : 1) * 0.003;
            const lngOffset = (Math.random() > 0.5 ? -1 : 1) * 0.003;
            b.dropoffCoords = { lat: b.originalDropoffCoords.lat + latOffset, lng: b.originalDropoffCoords.lng + lngOffset };
        }
      }
    });

    // TSP Optymalizacja dla wysiadek (Dropoff) - sortujemy trasę wysiadek wg najbliższego sąsiada od ostatniego punktu odbioru
    let dropoffSequence = [];
    let unassignedDropoffs = [...run];
    let lastPt = run[run.length-1].pickupCoords;
    let tspIters = 0;
    while(unassignedDropoffs.length > 0) {
       tspIters++;
       if (tspIters > 1000) { console.log('TSP HANG'); break; }
       let bestIdx = -1;
       let minDist = Infinity;
       for(let j=0; j<unassignedDropoffs.length; j++) {
          let c = unassignedDropoffs[j].dropoffCoords;
          let d = Math.pow(lastPt.lat - c.lat, 2) + Math.pow(lastPt.lng - c.lng, 2);
          if (d < minDist) { minDist = d; bestIdx = j; }
       }
       let best = unassignedDropoffs.splice(bestIdx, 1)[0];
       dropoffSequence.push(best);
       if (best && best.dropoffCoords) lastPt = best.dropoffCoords;
    }

    run.forEach(b => coords.push(`${b.pickupCoords.lng},${b.pickupCoords.lat}`));
    dropoffSequence.forEach(b => coords.push(`${b.dropoffCoords.lng},${b.dropoffCoords.lat}`));

    // Polyline decoder
    const decodePolyline = (str, precision = 6) => {
      let index = 0, lat = 0, lng = 0, coordinates = [], shift = 0, result = 0, byte = null, latitude_change, longitude_change, factor = Math.pow(10, precision);
      while (index < str.length) {
          byte = null; shift = 0; result = 0;
          do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
          latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
          shift = result = 0;
          do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
          longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
          lat += latitude_change; lng += longitude_change;
          coordinates.push([lng / factor, lat / factor]);
      }
      return coordinates;
    };

    console.log(`Sending Valhalla request for ${coords.length} points...`);
    const valhallaUrl = `https://valhalla1.openstreetmap.de/route`;
    const locations = [{lat: MDA_COORDS.lat, lon: MDA_COORDS.lng}];
    run.forEach(b => locations.push({lat: b.pickupCoords.lat, lon: b.pickupCoords.lng}));
    dropoffSequence.forEach(b => locations.push({lat: b.dropoffCoords.lat, lon: b.dropoffCoords.lng}));

    try {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      let allLegs = [];
      
      // Valhalla limit to 10 points. Dzielimy na mniejsze porcje (chunking).
      for (let i = 0; i < locations.length - 1; i += 8) {
          const chunk = locations.slice(i, i + 9);
          
          await new Promise(resolve => setTimeout(resolve, 300));
          const response = await fetch(valhallaUrl, {
             method: 'POST',
             body: JSON.stringify({locations: chunk, costing: 'auto'}),
             signal: AbortSignal.timeout(6000)
          });
          const data = await response.json();
          
          if (!data.trip) {
              console.error("Valhalla Error Chunk:", JSON.stringify(data));
              throw new Error(`Valhalla chunk error: ${data.error_code} - ${data.error}`);
          }
          allLegs = allLegs.concat(data.trip.legs);
      }
      
      let allCoords = [];
      allLegs.forEach(leg => {
          allCoords.push(...decodePolyline(leg.shape, 6));
      });
      
      const geojson = { type: "LineString", coordinates: allCoords };
      const totalDistanceKm = allLegs.reduce((sum, leg) => sum + leg.summary.length, 0);
      const runId = `RUN-${runCounter}-${idx}`;
      
      const legs = allLegs;
      let currentTimeMs = Date.now() + (2 * 60000); // 2min na wyjazd z bazy
      let startTime = currentTimeMs;
      
      let legIndex = 0;
      
      // Dojazd z bazy MDA do pierwszego punktu odbioru
      currentTimeMs += legs[legIndex].summary.time * trafficFactor * 1000;
      legIndex++;

      let currentBusOccupancy = 0;

      // Pickupy
      for (let i = 0; i < run.length; i++) {
        if (i > 0) {
          currentTimeMs += legs[legIndex].summary.time * trafficFactor * 1000;
          legIndex++;
        }
        
        run[i].occupancyAtBoarding = currentBusOccupancy;
        currentBusOccupancy += run[i].passengers;
        
        currentTimeMs += (2 * 60000); // 2 minuty postoju na wejście
        run[i].pickupTimestamp = currentTimeMs;
        run[i].pickupEta = new Date(currentTimeMs).toLocaleTimeString('pl-PL', { hour: '2-digit', minute:'2-digit' });
        run[i].status = 'offered'; 
        run[i].runId = runId;
        
        // Generujemy losową ocenę przejazdu w zależności od parametrów (Słaba pogoda i spacer obniżają ocenę)
        run[i].rating = (run[i].weather !== 'Słońce' && run[i].walkDistance > 200) ? 
                        Math.floor(Math.random() * 2) + 3 : // 3-4
                        Math.floor(Math.random() * 2) + 4; // 4-5
        if (run[i].profile === 'senior' && run[i].weather === 'Słońce') run[i].rating = 5;

        // Obliczanie indywidualnego dystansu w linii prostej (Haversine)
        const lat1 = run[i].pickupCoords.lat * Math.PI/180;
        const lat2 = (run[i].originalDropoffCoords ? run[i].originalDropoffCoords.lat : run[i].dropoffCoords.lat) * Math.PI/180;
        const dLat = lat2 - lat1;
        const dLng = ((run[i].originalDropoffCoords ? run[i].originalDropoffCoords.lng : run[i].dropoffCoords.lng) - run[i].pickupCoords.lng) * Math.PI/180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) * Math.sin(dLng/2);
        const individualDistKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        // Realistyczne ceny MPK: Base 2.00 PLN + 0.30 PLN per km
        let originalPrice = 2.00 + (individualDistKm * 0.30);
        let dynPrice = originalPrice;
        if (run[i].discountMultiplier) {
            dynPrice = dynPrice * run[i].discountMultiplier;
            run[i].originalPrice = originalPrice.toFixed(2) + ' PLN';
        }
        run[i].price = dynPrice.toFixed(2) + ' PLN';
      }
      
      const runCost = (totalDistanceKm * 1.20).toFixed(2); // 1.20 PLN per km - super tani, zoptymalizowany elektryk (EV)
      
      // Przejazd do pierwszego punktu zrzutu
      currentTimeMs += legs[legIndex].summary.time * trafficFactor * 1000;
      legIndex++;

      // Dropoffy
      for (let i = 0; i < dropoffSequence.length; i++) {
        if (i > 0) {
          currentTimeMs += legs[legIndex].summary.time * trafficFactor * 1000;
          legIndex++;
        }
        currentTimeMs += (60000); // 1 minuta postoju na wyjście
        dropoffSequence[i].dropoffTimestamp = currentTimeMs;
        dropoffSequence[i].dropoffEta = new Date(currentTimeMs).toLocaleTimeString('pl-PL', { hour: '2-digit', minute:'2-digit' });
      }

      globalRoutes.push({ runId, geojson, startTime, endTime: currentTimeMs, totalDistanceKm, runCost });
    } catch (e) {
      console.error("OSRM Error, using fallback:", e.message);
      
      // Zabezpieczenie na wypadek awarii zewnętrznego API OSRM (np. limity darmowego serwera)
      // Generujemy przybliżoną trasę w oparciu o linie proste i dystans Euklidesowy/Haversine
      const haversineDist = (p1, p2) => {
        const lat1 = p1.lat * Math.PI/180, lat2 = p2.lat * Math.PI/180;
        const dLat = lat2 - lat1, dLng = (p2.lng - p1.lng) * Math.PI/180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) * Math.sin(dLng/2);
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      };

      const runId = `RUN-${runCounter}-${idx}`;
      let currentTimeMs = Date.now() + (2 * 60000); 
      let startTime = currentTimeMs;
      
      let totalDistanceKm = 0;
      let geojsonCoords = [[MDA_COORDS.lng, MDA_COORDS.lat]];
      let prevPt = MDA_COORDS;
      const routeSpeedKmh = 30; 
      
      let currentBusOccupancy = 0;

      for (let i = 0; i < run.length; i++) {
         const pt = run[i].pickupCoords;
         const dist = haversineDist(prevPt, pt) * 1.3; // 1.3 to współczynnik krętości drogi
         totalDistanceKm += dist;
         currentTimeMs += (dist / routeSpeedKmh) * 3600000; 
         currentTimeMs += (2 * 60000); 
         
         run[i].occupancyAtBoarding = currentBusOccupancy;
         currentBusOccupancy += run[i].passengers;

         geojsonCoords.push([pt.lng, pt.lat]);
         prevPt = pt;
         
         run[i].pickupTimestamp = currentTimeMs;
         run[i].pickupEta = new Date(currentTimeMs).toLocaleTimeString('pl-PL', { hour: '2-digit', minute:'2-digit' });
         run[i].status = 'offered'; 
         run[i].runId = runId;

         run[i].rating = (run[i].weather !== 'Słońce' && run[i].walkDistance > 200) ? 
                         Math.floor(Math.random() * 2) + 3 :
                         Math.floor(Math.random() * 2) + 4;
         if (run[i].profile === 'senior' && run[i].weather === 'Słońce') run[i].rating = 5;
         
         const individualDistKm = haversineDist(run[i].pickupCoords, run[i].originalDropoffCoords || run[i].dropoffCoords);
         let originalPrice = 2.00 + (individualDistKm * 0.30);
         let dynPrice = originalPrice;
         if (run[i].discountMultiplier) {
             dynPrice = dynPrice * run[i].discountMultiplier;
             run[i].originalPrice = originalPrice.toFixed(2) + ' PLN';
         }
         run[i].price = dynPrice.toFixed(2) + ' PLN';
      }
      
      for (let i = 0; i < dropoffSequence.length; i++) {
         const pt = dropoffSequence[i].dropoffCoords;
         const dist = haversineDist(prevPt, pt) * 1.3;
         totalDistanceKm += dist;
         currentTimeMs += (dist / routeSpeedKmh) * 3600000;
         currentTimeMs += 60000; 
         
         geojsonCoords.push([pt.lng, pt.lat]);
         prevPt = pt;
         
         dropoffSequence[i].dropoffTimestamp = currentTimeMs;
         dropoffSequence[i].dropoffEta = new Date(currentTimeMs).toLocaleTimeString('pl-PL', { hour: '2-digit', minute:'2-digit' });
      }

      const runCost = (totalDistanceKm * 1.20).toFixed(2);
      const geojson = { type: 'LineString', coordinates: geojsonCoords };
      globalRoutes.push({ runId, geojson, startTime, endTime: currentTimeMs, totalDistanceKm, runCost });
    }
  }
  
  res.json({ success: true, message: 'Trasy optymalnie wyznaczone!' });
});

app.listen(PORT, () => console.log(`Smart Village Server (Port: ${PORT})`));
