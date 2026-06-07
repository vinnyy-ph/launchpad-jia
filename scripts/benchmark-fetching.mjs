// scripts/benchmark-fetching.mjs
// Benchmark the two optimized endpoints. No dependencies.
//
//   BENCH_TOKEN=<firebase-id-token> node scripts/benchmark-fetching.mjs \
//     --base http://localhost:3000 --career <careerID> [--runs 10] [--limit 10]
//
// Prints mean/p50/p95/min/max per endpoint. Used to produce the numbers in
// OPTIMIZE_FETCHING.md — re-run with the same flags to reproduce.
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const BASE = arg("base", "http://localhost:3000");
const CAREER = arg("career", null);
const RUNS = parseInt(arg("runs", "10"), 10);
const LIMIT = arg("limit", "10");
const TOKEN = process.env.BENCH_TOKEN;
if (!CAREER || !TOKEN) {
  console.error("Usage: BENCH_TOKEN=<idToken> node scripts/benchmark-fetching.mjs --career <careerID> [--base url] [--runs n]");
  process.exit(1);
}

const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  return { mean, p50: q(0.5), p95: q(0.95), min: s[0], max: s[s.length - 1] };
};

async function bench(label, url) {
  await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } }); // warmup
  const times = [];
  let bytes = 0, status = 0;
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const body = await res.arrayBuffer();
    times.push((performance.now() - t0) / 1000);
    bytes = body.byteLength; status = res.status;
  }
  const { mean, p50, p95, min, max } = stats(times);
  console.log(
    `${label.padEnd(28)} n=${RUNS} mean=${mean.toFixed(3)}s p50=${p50.toFixed(3)}s ` +
    `p95=${p95.toFixed(3)}s min=${min.toFixed(3)}s max=${max.toFixed(3)}s bytes=${bytes} http=${status}`
  );
  return mean;
}

const interviewsMean = await bench("get-career-interviews", `${BASE}/api/get-career-interviews?careerID=${CAREER}`);
const applicantsMean = await bench("get-career-applicants", `${BASE}/api/get-career-applicants?careerID=${CAREER}&page=1&limit=${LIMIT}`);
const pass = interviewsMean < 1 && applicantsMean < 1;
console.log(pass ? "TARGET MET: both endpoints < 1s average" : "TARGET NOT MET");
process.exit(pass ? 0 : 1);
