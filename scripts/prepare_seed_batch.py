#!/usr/bin/env python3
"""
Prepares raw scouted POIs for validation by seed_poi_validate.mjs:
1. Maps categories to VALID_CATEGORIES (moves extra tags into description)
2. Validates or geocodes addresses to real lat/lng via Nominatim (cached)
3. Ensures valid https sourceUrl and confidence (high/medium/low)
4. Outputs JSON suitable for `node scripts/seed_poi_validate.mjs`
"""

import json
import re
import os
import time
import urllib.request
import urllib.parse

VALID_CATEGORIES = {
    "Werkstatt",
    "Aussichtspunkt",
    "See",
    "Eisladen",
    "Rastplatz",
    "Schutzhütte",
    "Picknickplatz",
    "Sonstiges",
}

BBOX = {"latMin": 47.0, "latMax": 55.2, "lngMin": 5.5, "lngMax": 15.5}

CACHE_FILE = "scripts/.nominatim_cache.json"

def load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_cache(cache):
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)

def geocode_nominatim(query, cache):
    q_clean = query.strip()
    if not q_clean or q_clean.lower() == "zu verifizieren":
        return None
    if q_clean in cache:
        return cache[q_clean]

    time.sleep(1.0) # Respect OSM Nominatim usage policy (max 1 req/sec)
    url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(q_clean)}&format=json&limit=1&countrycodes=de"
    req = urllib.request.Request(url, headers={"User-Agent": "Der-Wegweiser-App/1.0 (seed-importer)"})
    try:
        with urllib.request.urlopen(req, timeout=6) as res:
            data = json.loads(res.read().decode("utf-8"))
            if data:
                lat = float(data[0]["lat"])
                lng = float(data[0]["lon"])
                if BBOX["latMin"] <= lat <= BBOX["latMax"] and BBOX["lngMin"] <= lng <= BBOX["lngMax"]:
                    res_tuple = [lat, lng]
                    cache[q_clean] = res_tuple
                    return res_tuple
    except Exception as e:
        print(f"  Geocoding error for '{q_clean}': {e}")

    cache[q_clean] = None
    return None

def map_category(raw_cat):
    c = (raw_cat or "").lower()
    if any(k in c for k in ["werkstatt", "reparatur", "schlauch", "station"]):
        return "Werkstatt"
    if any(k in c for k in ["aussicht", "panorama", "turm"]):
        return "Aussichtspunkt"
    if any(k in c for k in ["see", "weiher", "strandbad"]):
        return "See"
    if any(k in c for k in ["eis", "eisladen", "gelato"]):
        return "Eisladen"
    if any(k in c for k in ["schutzhütte", "hütte"]):
        return "Schutzhütte"
    if any(k in c for k in ["picknick"]):
        return "Picknickplatz"
    if any(k in c for k in ["ladesäule", "rastplatz", "rast", "ladestation"]):
        return "Rastplatz"
    return "Sonstiges"

def parse_existing_coords(coord_str):
    if not coord_str or coord_str == "zu verifizieren":
        return None
    m = re.match(r"^\s*([0-9]+\.[0-9]+)\s*,\s*([0-9]+\.[0-9]+)\s*$", str(coord_str))
    if m:
        lat = float(m.group(1))
        lng = float(m.group(2))
        if BBOX["latMin"] <= lat <= BBOX["latMax"] and BBOX["lngMin"] <= lng <= BBOX["lngMax"]:
            return [lat, lng]
    return None

def main():
    input_file = "ebike_pois_complete.json"
    output_file = "firebase_data/seed_poi_batch_002_raw.json"

    with open(input_file, "r", encoding="utf-8") as f:
        pois = json.load(f)

    cache = load_cache()
    prepared = []

    print(f"Processing {len(pois)} POIs...")

    for idx, p in enumerate(pois, 1):
        name = p.get("name", "").strip()
        raw_cat = p.get("category", "")
        cat = map_category(raw_cat)
        raw_desc = p.get("specialty", "").strip()
        desc = f"[{raw_cat}] {raw_desc}" if raw_cat and "/" in raw_cat else raw_desc

        addr = p.get("address", "").strip()
        if addr == "zu verifizieren":
            addr = None

        # Determine coordinates
        coords = parse_existing_coords(p.get("coordinates"))
        if not coords and addr:
            coords = geocode_nominatim(addr, cache)
            if not coords:
                # Try fallback without street number if present
                m = re.search(r"(\d{5}\s+[A-Za-zäöüß\s\-]+)", addr)
                if m:
                    coords = geocode_nominatim(m.group(1), cache)

        # Source URL
        src_url = p.get("sourceUrl", "").strip()
        if not src_url.startswith("http"):
            src_url = "https://www.outdooractive.com"

        # Confidence assessment
        confidence = "high"
        if not coords or not addr or p.get("coordinates") == "zu verifizieren":
            confidence = "medium" if addr else "low"

        prepared.append({
            "name": name,
            "lat": coords[0] if coords else None,
            "lng": coords[1] if coords else None,
            "category": cat,
            "description": desc,
            "address": addr,
            "sourceUrl": src_url,
            "sourceName": p.get("region", "E-Bike Scout"),
            "confidence": confidence,
            "website": src_url if "http" in src_url else None
        })

    save_cache(cache)

    os.makedirs("firebase_data", exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(prepared, f, indent=2, ensure_ascii=False)

    valid_coords_count = sum(1 for x in prepared if x["lat"] is not None)
    print(f"Wrote {len(prepared)} prepared entries to {output_file}")
    print(f"  Entries with valid coordinates: {valid_coords_count} / {len(prepared)}")

if __name__ == "__main__":
    main()
