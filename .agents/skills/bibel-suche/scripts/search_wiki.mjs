#!/usr/bin/env node
/**
 * search_wiki.mjs
 * CLI helper to search the authoritative Bibel der Schande v2.1 wiki endpoint.
 * Usage: node search_wiki.mjs "<query>" [max_results=5] [min_relevance=0.2]
 */

const query = process.argv[2];
const maxResults = parseInt(process.argv[3] || '5', 10);
const minRelevance = parseFloat(process.argv[4] || '0.2');

if (!query) {
  console.error('Usage: node search_wiki.mjs "<query>" [max_results] [min_relevance]');
  process.exit(1);
}

const endpoint = 'http://bibel.local/api/wiki/search';

async function search() {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        min_relevance: minRelevance,
        version: '2.1',
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    console.log(`\n=== Bibel der Schande v2.1 Wiki-Suche: "${query}" ===`);
    console.log(`Treffer: ${data.total_results} (${data.search_time_ms}ms)\n`);

    if (!data.results || data.results.length === 0) {
      console.log('Keine Treffer gefunden (relevance >= ' + minRelevance + ').');
      return;
    }

    for (const r of data.results) {
      console.log(`• [${r.type.toUpperCase()}] ${r.title} (Relevanz: ${(r.relevance * 100).toFixed(0)}%)`);
      console.log(`  ID: ${r.id} | Page: ${r.pageId}`);
      if (r.tags && r.tags.length > 0) {
        console.log(`  Tags: ${r.tags.join(', ')}`);
      }
      console.log(`  Auszug: ${r.excerpt}\n`);
    }
  } catch (err) {
    console.error(`Wiki-Suche fehlgeschlagen (${endpoint}):`, err.message);
    process.exit(1);
  }
}

search();
