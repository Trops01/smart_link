---
marp: true
theme: default
class:
  - lead
style: |
  section {
    background-color: #f8fafc;
    font-family: 'Segoe UI', system-ui, sans-serif;
  }
  h1 {
    color: #111827;
    font-size: 3rem;
  }
  h2 {
    color: #4ade80;
    font-size: 2.2rem;
  }
  .footer {
    color: #6b7280;
  }
  .columns {
    display: flex;
    gap: 2rem;
  }
  .col {
    flex: 1;
  }
---

# 🚌 SmartLink
## Inteligentny Transport na Żądanie (DRT)
Odkorkujmy miasta, włączmy wykluczonych i zoptymalizujmy flotę.

---

# 🚨 Problem
- **Puste przebiegi:** Tradycyjne nocne i podmiejskie linie jeżdżą puste, generując gigantyczne koszty i emisję CO2.
- **Wykluczenie Transportowe:** 500 metrów do przystanku to żaden problem dla studenta, ale bariera nie do przejścia dla seniora.
- **Brak adaptacji:** Zwykłe rozkłady jazdy ignorują realne warunki (pogoda, dynamiczny popyt, opóźnienia).

---

# 💡 Nasze Rozwiązanie: B2G MaaS
**SmartLink** to system Dynamicznego Transportu na Żądanie, który działa jak usługa premium, ale dla transportu publicznego.
- ⚡ **Algorytm VRP:** Dynamicznie grupuje pasażerów w czasie rzeczywistym.
- 🌍 **Zrównoważony Rozwój:** Optymalizacja środowiskowa i liczenie śladu CO2 dla każdego przejazdu.
- 📊 **Analityka:** Potężny kokpit dla dyspozytorów oparty na danych miejskich i predykcji.

---

# 🧠 Inteligencja Danych (Urban Data)
Zaimplementowaliśmy **Inteligentne Profilowanie (Dynamic Walking Distance)**:

- 🧓 **Seniorzy i Osoby z Niepełnosprawnością:** Gwarancja *door-to-door* (0-50m).
- 🎒 **Dzieci i Uczniowie:** Zbierani wyłącznie z bezpiecznych ciągów pieszych (do 200m).
- 👤 **Dorośli (Grywalizacja):** Dochodzą do węzłów (do 800m) zyskując **30% zniżki** w zamian za pomoc w skróceniu trasy autobusu.
- 🌧️ **Warunki atmosferyczne:** Algorytm automatycznie redukuje dystans dojścia o 50% podczas deszczu i śniegu.

---

# 📈 Optymalizacja Floty w Locie
- **Natychmiastowe Przeliczanie Tras (Nearest Neighbor TSP):**
  Autobusy zbierają ludzi z lokalnych stref (promień ~3km), a przystanki docelowe są dynamicznie sortowane w locie po najkrótszej łącznej ścieżce.
- **Mechanizm No-Show & QR:** 
  Gdy pasażer nie zeskanuje cyfrowego biletu w busie, dyspozytornia blokuje jego przejazd, a algorytm natychmiast omija jego punkt docelowy. *Oszczędzony czas jest oddawany innym pasażerom.*

---

![bg contain](C:/Users/Piotr/.gemini/antigravity/brain/6a3a70ba-44f6-43a9-bf84-1104731a0e6d/.user_uploaded/media_1791072240262.png)

---

![bg contain](C:/Users/Piotr/.gemini/antigravity/brain/6a3a70ba-44f6-43a9-bf84-1104731a0e6d/.user_uploaded/media_1791072716949.png)

---

# 🚀 Podsumowanie (Smart City)
Projekt SmartLink idealnie wpisuje się w kryteria nowoczesnych miast:
- **Dostępność przestrzeni:** Całkowite zniesienie barier dla osób starszych i wykluczonych ruchowo.
- **Data-Driven:** Wykorzystanie w 100% geolokalizacji, pogody i profilowania pasażerów do sterowania miastem.
- **Skalowalność:** Technologia gotowa na integrację z KKM (Krakowską Kartą Miejską) oraz flotami elektrycznymi.

**Dziękujemy za uwagę!**
