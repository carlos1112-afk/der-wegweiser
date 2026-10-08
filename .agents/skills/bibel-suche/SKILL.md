---
name: bibel-suche
description: >-
  Semantische Suche über die autoritative Bibel der Schande v2.1 Wiki auf http://bibel.local/api/wiki/search.
  Nutzen bei Unsicherheiten bzgl. Schandliste, Sechs Säulen der Prüfung, Compliance (EU AI Act, DSGVO),
  Mutation Testing und Qualitätsvorgaben.
---

# Bibel der Schande v2.1 — Wiki-Suche Skill

Dieser Skill ermöglicht es Agents, bei Unsicherheiten oder regulatorischen Fragen die **Bibel der Schande v2.1** zu durchsuchen.

## Wann verwenden?
- Vor heiklen Architektur-, Sicherheits- oder Datenentscheidungen.
- Zur Klärung der sechs Säulen der Prüfung oder der 14 Schandliste-Verbote.
- Zur Recherche von Compliance-Anforderungen (EU AI Act, DSGVO Art. 35, IEC 62443).
- Bei der Formulierung von Teststrategien (Mutation Testing, Negativtests).

## Verwendung via Skript

Führe das mitgelieferte Suchskript aus:
```bash
node .agents/skills/bibel-suche/scripts/search_wiki.mjs "<Suchbegriff>" [max_results=5] [min_relevance=0.2]
```

Beispiele:
```bash
node .agents/skills/bibel-suche/scripts/search_wiki.mjs "Negativtest"
node .agents/skills/bibel-suche/scripts/search_wiki.mjs "Schandliste" 5 0.5
node .agents/skills/bibel-suche/scripts/search_wiki.mjs "EU AI Act High-Risk" 3 0.4
```

## Verwendung via HTTP (cURL)
```bash
curl -s -X POST http://bibel.local/api/wiki/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Mutation Testing", "max_results": 5, "min_relevance": 0.3, "version": "2.1"}'
```

## Entscheidungsregel
- Nur Ergebnisse mit `relevance > 0.5` als autoritativ anwenden.
- Bei Widersprüchen zwischen lokalem Code und der Wiki: **Wiki hat Vorrang.**
- Wenn kein Treffer gefunden wird: **Nicht raten**, sondern explizit dokumentieren (*„Nicht in der Bibel der Schande v2.1 gefunden“*).
