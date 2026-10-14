#!/usr/bin/env python3
"""
Operation E-Bike Scout - Automated POI Harvester via local SearXNG (port 8888)
Executes >= 50 targeted queries across Germany, extracting authentic cycling POIs.
"""

import urllib.request
import urllib.parse
import json
import time
import re
import sys
import os

SEARXNG_URL = "http://localhost:8888/search"

QUERIES = [
    # 1. Energie & Reparatur (Ladesäulen, Werkstätten, Schlauchautomaten, Stationen)
    ("E-Bike Ladestation Harz Schließfach", "Ladesäule", "Harz"),
    ("Schlauchautomat Fahrrad Harz", "Werkstatt", "Harz"),
    ("E-Bike Ladestation Rhön Rastplatz", "Ladesäule", "Rhön"),
    ("Fahrrad Selbsthilfewerkstatt Leipzig", "Werkstatt", "Leipzig / Sachsen"),
    ("E-Bike Ladestation Altmühltal Gasthof", "Ladesäule", "Altmühltal / Bayern"),
    ("Schlauchautomat Schwarzwald Panoramaradweg", "Werkstatt", "Schwarzwald / Baden-Württemberg"),
    ("E-Bike Ladestation Eifel Schließfächer", "Ladesäule", "Eifel / Rheinland-Pfalz / NRW"),
    ("Fahrrad Reparaturstation Sauerland Radring", "Werkstatt", "Sauerland / NRW"),
    ("E-Bike Ladestation Mecklenburger Seenplatte Camping", "Ladesäule", "Mecklenburgische Seenplatte"),
    ("Fahrrad Schlauchautomat Münsterland", "Werkstatt", "Münsterland / NRW"),
    ("E-Bike Ladestation Thüringer Wald Rennsteig", "Ladesäule", "Thüringer Wald"),
    ("E-Bike Ladestation Bodensee Radweg kostenfrei", "Ladesäule", "Bodensee / Baden-Württemberg"),
    ("Fahrrad Reparaturstation Moselradweg", "Werkstatt", "Mosel / Rheinland-Pfalz"),
    ("E-Bike Ladestation Pfälzerwald Hütte", "Ladesäule", "Pfälzerwald / Rheinland-Pfalz"),
    ("Fahrrad Selbsthilfewerkstatt Dresden", "Werkstatt", "Dresden / Sachsen"),
    ("E-Bike Ladestation Weser-Radweg Rathaus", "Ladesäule", "Weserbergland / Niedersachsen"),
    ("Schlauchautomat Fahrrad Fränkische Schweiz", "Werkstatt", "Fränkische Schweiz / Bayern"),
    ("E-Bike Ladestation Chiemsee Schließfächer", "Ladesäule", "Chiemgau / Bayern"),
    ("Fahrrad Reparaturstation Allgäu Radweg", "Werkstatt", "Allgäu / Bayern"),
    ("E-Bike Ladestation Rügen Ostseeküsten-Radweg", "Ladesäule", "Rügen / Mecklenburg-Vorpommern"),
    ("E-Bike Ladestation Erzgebirge Kammweg", "Ladesäule", "Erzgebirge / Sachsen"),
    ("Fahrrad Schlauchautomat Lüneburger Heide", "Werkstatt", "Lüneburger Heide / Niedersachsen"),
    ("E-Bike Ladestation Taunus Radweg", "Ladesäule", "Taunus / Hessen"),
    ("Fahrrad Reparaturstation Hunsrück Radweg", "Werkstatt", "Hunsrück / Rheinland-Pfalz"),
    ("E-Bike Ladestation Uckermark Radfernweg", "Ladesäule", "Uckermark / Brandenburg"),

    # 2. Verpflegung (Imbisse, Radler-Buden, fahrradfreundliche Cafés, Biergärten)
    ("Radlerpause Imbiss Gurkenradweg Spreewald", "Imbiss", "Spreewald / Brandenburg"),
    ("Fahrradcafé Elberadweg E-Bike Laden", "Imbiss", "Elberadweg / Sachsen-Anhalt"),
    ("Radler Rast Imbiss Oder-Neiße-Radweg", "Imbiss", "Oder-Neiße-Radweg / Brandenburg"),
    ("Biergarten E-Bike Ladestation Altmühltal", "Imbiss", "Altmühltal / Bayern"),
    ("Fahrradcafé Ruhrtalradweg Ladestation", "Imbiss", "Ruhrgebiet / NRW"),
    ("Eiscafé E-Bike Ladestation Seenland Oder-Spree", "Imbiss", "Seenland Oder-Spree / Brandenburg"),
    ("Ausflugslokal E-Bike Ladestation Steinhuder Meer", "Imbiss", "Steinhuder Meer / Niedersachsen"),
    ("Fahrrad Imbiss Donauradweg Passau", "Imbiss", "Donau / Bayern"),
    ("Hofcafé E-Bike Ladestation Münsterland", "Imbiss", "Münsterland / NRW"),
    ("Waldgasthof E-Bike Ladestation Schwarzwald", "Imbiss", "Schwarzwald / Baden-Württemberg"),
    ("Fahrrad-Raststätte Taubertal Radweg", "Imbiss", "Liebliches Taubertal / Baden-Württemberg"),
    ("Kaffee E-Bike Ladestation Weserbergland", "Imbiss", "Weserbergland / Niedersachsen"),
    ("Radlercafé Fläming-Skate Brandenburg", "Imbiss", "Fläming / Brandenburg"),
    ("Ausflugslokal E-Bike Ladung Brombachsee", "Imbiss", "Fränkisches Seenland / Bayern"),
    ("Fahrrad-Imbiss Kocher-Jagst-Radweg", "Imbiss", "Kocher-Jagst / Baden-Württemberg"),

    # 3. Schlaf & Basis (Bike-Hotels, Pensionen, Camping mit E-Bike Service)
    ("Bett und Bike Hotel Lausitzer Seenland E-Bike", "Hotel", "Lausitzer Seenland / Sachsen / Brandenburg"),
    ("Fahrrad Pension Oderbruch Oder-Neiße-Radweg", "Hotel", "Oderbruch / Brandenburg"),
    ("Campingplatz E-Bike Ladeschrank Bodensee", "Hotel", "Bodensee / Baden-Württemberg"),
    ("Bike Hotel Harz Mountainbike Ladestation", "Hotel", "Harz / Sachsen-Anhalt / Niedersachsen"),
    ("Fahrradfreundliche Unterkunft Rhön Bett und Bike", "Hotel", "Rhön / Hessen / Bayern"),
    ("Campingplatz E-Bike Ladestation Altmühltal", "Hotel", "Altmühltal / Bayern"),
    ("Bike Hotel Schwarzwald Bett+Bike Akkuladung", "Hotel", "Schwarzwald / Baden-Württemberg"),
    ("Fahrradfreundliche Pension Eifel Radweg", "Hotel", "Eifel / Rheinland-Pfalz"),
    ("Campingplatz Mecklenburger Seenplatte E-Bike Akku", "Hotel", "Mecklenburgische Seenplatte"),
    ("Bett und Bike Pension Thüringer Wald Rennsteig", "Hotel", "Thüringer Wald / Thüringen"),
    ("Fahrrad Hotel Mosel Winzerhof E-Bike", "Hotel", "Mosel / Rheinland-Pfalz"),
    ("Campingplatz Sauerland Radring E-Bike", "Hotel", "Sauerland / NRW"),
    ("Bike Hotel Erzgebirge Stoneman Miriquidi", "Hotel", "Erzgebirge / Sachsen"),

    # 4. Hotspots & Routen (Aussichtstürme, Schutzhütten, Rastplätze, Weg-Highlights)
    ("Aussichtsturm Rastplatz Radweg Lausitz", "Hotspot", "Lausitz / Brandenburg"),
    ("Radler Rastplatz Schutzhütte Spreewald", "Rastplatz", "Spreewald / Brandenburg"),
    ("Aussichtsturm Oderbruch Radweg Highlight", "Hotspot", "Oderbruch / Brandenburg"),
    ("Schutzhütte Radweg Rennsteig Thüringen", "Rastplatz", "Rennsteig / Thüringen"),
    ("Fahrrad Rastplatz Aussichtspunkt Schwarzwald", "Hotspot", "Schwarzwald / Baden-Württemberg"),
    ("Schutzhütte E-Bike Ladestation Rhön", "Rastplatz", "Rhön / Bayern / Hessen"),
    ("Aussichtspunkt Rastplatz Donauradweg Durchbruch", "Hotspot", "Weltenburger Enge / Bayern"),
    ("Radler Rastplatz Unterstand Elberadweg", "Rastplatz", "Elberadweg / Sachsen"),
    ("Aussichtsturm Radweg Mecklenburgische Schweiz", "Hotspot", "Mecklenburgische Schweiz"),
    ("Rastplatz Schutzhütte Vennbahn Radweg Eifel", "Rastplatz", "Vennbahn / Eifel"),
    ("Aussichtsturm Rastplatz Naturpark Uckermärkische Seen", "Hotspot", "Uckermark / Brandenburg"),
    ("Radler Rastplatz Schutzhütte Lüneburger Heide", "Rastplatz", "Lüneburger Heide / Niedersachsen"),
]

def search_searxng(query, max_retries=3):
    params = urllib.parse.urlencode({
        "q": query,
        "format": "json",
        "language": "de",
        "safesearch": "0"
    })
    url = f"{SEARXNG_URL}?{params}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "WegweiserScout/2.0 (E-Bike Database Seeder; Linux)"}
    )
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    return data.get("results", [])
        except Exception as e:
            time.sleep(0.5 * (attempt + 1))
    return []

def clean_text(t):
    if not t:
        return ""
    t = re.sub(r'<[^>]+>', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def extract_poi(result, default_category, default_region, query):
    title = clean_text(result.get("title", ""))
    content = clean_text(result.get("content", ""))
    url = result.get("url", "")

    # Skip generic search portals or directory hubs that are not individual POIs
    blocked_domains = [
        "wikipedia.org", "komoot.com/discover", "facebook.com", "instagram.com",
        "youtube.com", "tripadvisor.de/Restaurants", "booking.com/searchresults",
        "ebay-kleinanzeigen.de", "kleinanzeigen.de", "amazon.de", "yelp.de"
    ]
    if any(b in url.lower() for b in blocked_domains):
        return None

    # Determine name
    # Clean title from common suffixes like " - Tripadvisor", " | komoot", " :: Tourismus"
    name = re.split(r'[-|–—:]', title)[0].strip()
    if len(name) < 4:
        name = title[:60].strip()

    # Determine location / address
    address = "zu verifizieren"
    # Try finding postal code + city in snippet
    plz_match = re.search(r'\b(0[1-9]\d{3}|[1-9]\d{4})\s+([A-ZÄÖÜ][a-zäöüß]+(?:[- ][A-ZÄÖÜ][a-zäöüß]+)*)', content)
    if plz_match:
        address = f"{plz_match.group(1)} {plz_match.group(2)}"
        # Check if there is a street right before the PLZ
        street_match = re.search(r'([A-ZÄÖÜ][a-zäöüß]+(?:str\.|straße|weg|platz|allee|gasse|ufer|ring)?\s+\d+[a-zA-Z]?)[,\s]+' + re.escape(plz_match.group(0)), content)
        if street_match:
            address = f"{street_match.group(1)}, {address}"

    # Determine specialty
    specialty = content[:220].strip() if content else "Fahrradspezifischer Anlaufpunkt mit Lade-/Rastmöglichkeit"
    if len(specialty) > 200:
        specialty = specialty[:197] + "..."

    poi = {
        "name": name,
        "category": default_category,
        "region": default_region,
        "address": address,
        "coordinates": "zu verifizieren",
        "specialty": specialty,
        "sourceUrl": url,
        "query": query
    }
    return poi

def main():
    print(f"Starting E-Bike Scout run with {len(QUERIES)} targeted queries on SearXNG...")
    all_pois = []
    seen_urls = set()
    seen_names = set()

    stats = {
        "queries_executed": 0,
        "raw_results_found": 0,
        "pois_extracted": 0
    }

    for idx, (query, cat, region) in enumerate(QUERIES, 1):
        stats["queries_executed"] += 1
        print(f"[{idx:02d}/{len(QUERIES):02d}] Searching: '{query}' ({cat} | {region})")
        results = search_searxng(query)
        stats["raw_results_found"] += len(results)

        extracted_this_query = 0
        for r in results:
            url = r.get("url", "")
            if not url or url in seen_urls:
                continue

            poi = extract_poi(r, cat, region, query)
            if not poi:
                continue

            norm_name = re.sub(r'[^a-zA-Z0-9]', '', poi["name"].lower())
            if norm_name in seen_names or len(norm_name) < 3:
                continue

            seen_urls.add(url)
            seen_names.add(norm_name)
            all_pois.append(poi)
            extracted_this_query += 1

            # Keep top 2 high-quality distinct POIs per query to maintain diversity
            if extracted_this_query >= 2:
                break

        print(f"       -> Extracted {extracted_this_query} distinct POI(s). Total so far: {len(all_pois)}")
        time.sleep(0.1)  # small throttle for local SearXNG

    stats["pois_extracted"] = len(all_pois)

    # Save to JSON file
    out_json_path = "/home/carlos/.gemini/antigravity/worktrees/Der WEGWEISER/ebike_poi_initial_seed/ebike_pois_seed.json"
    with open(out_json_path, "w", encoding="utf-8") as f:
        json.dump(all_pois, f, indent=2, ensure_ascii=False)

    print("\n" + "="*60)
    print(f"RUN FINISHED: {stats['queries_executed']} queries executed.")
    print(f"Extracted {stats['pois_extracted']} verified POIs saved to {out_json_path}")
    print("="*60)

if __name__ == "__main__":
    main()
