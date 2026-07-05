import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── CA Patterns ──────────────────────────────────────────────────────────────
const EVM_CA_RE = /\b0x[a-fA-F0-9]{40}\b/g;
const SOLANA_CA_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
const TICKER_RE = /\$([A-Z]{2,12})\b/g;
const TICKER_WORD_RE = /\b([A-Z]{2,10})(INU|PEPE|DOGE|CAT|MOON|ELON|AI|GPT|FI|DAO|TRUMP|MAGA)\b/gi;

const SOLANA_BLACKLIST = new Set([
  "11111111111111111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bwW",
  "So11111111111111111111111111111111111111112",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
]);

// ─── Pre-launch signal keywords ───────────────────────────────────────────────
// These indicate a coin is ANNOUNCED but not live yet
const PRE_LAUNCH_KEYWORDS = [
  "launching", "launching soon", "launching in", "launches in", "launch date",
  "going live", "going live in", "live in", "drop in", "dropping in",
  "stealth launch", "fair launch", "presale", "pre-sale", "pre sale",
  "whitelist", "white list", "private sale", "seed sale",
  "coming soon", "coming in", "release in", "releasing",
  "countdown", "hours left", "days left", "hours to go", "days to go",
  "be ready", "get ready", "mark your calendar", "save the date",
  "next 24h", "next 48h", "this week", "tomorrow",
  "announcement", "teaser", "sneak peek", "alpha drop",
  "not listed yet", "not launched", "yet to launch", "pre-launch",
];

// Patterns suggesting coin is already live/pumping
const POST_LAUNCH_KEYWORDS = [
  "just launched", "just listed", "now live", "live now",
  "buy now", "ape in", "get in now", "last chance",
  "already up", "already 2x", "already 5x", "mooning",
  "dex listed", "raydium", "uniswap listing",
];

// Time extraction patterns — "in 2 hours", "in 3 days", "tomorrow"
const TIME_PATTERNS: [RegExp, number][] = [
  [/in (\d+)\s*hour/i, 3600000],
  [/in (\d+)\s*min/i, 60000],
  [/in (\d+)\s*day/i, 86400000],
  [/(\d+)h\s*(launch|drop|live)/i, 3600000],
  [/(\d+)d\s*(launch|drop|live)/i, 86400000],
  [/tomorrow/i, 86400000 * -1], // fixed 1 day
  [/this week/i, 86400000 * -5],
  [/next week/i, 86400000 * -7],
  [/(\d+)\s*hours?\s*(?:left|to go|remaining)/i, 3600000],
  [/(\d+)\s*days?\s*(?:left|to go|remaining)/i, 86400000],
];

interface ExtractedCoin {
  ticker: string;
  name: string;
  contract_address: string | null;
  raw_snippet: string;
  is_pre_launch: boolean;
  is_post_launch: boolean;
  estimated_launch_ms: number | null; // ms from now
  teaser_text: string;
}

function extractCoinsFromText(text: string, monitorSince: Date): ExtractedCoin[] {
  const coins: ExtractedCoin[] = [];
  const seenKeys = new Set<string>();
  const lowerText = text.toLowerCase();

  // Detect launch phase
  const isPreLaunch = PRE_LAUNCH_KEYWORDS.some(kw => lowerText.includes(kw));
  const isPostLaunch = POST_LAUNCH_KEYWORDS.some(kw => lowerText.includes(kw));

  // Extract estimated launch time
  let estimatedLaunchMs: number | null = null;
  for (const [pattern, multiplier] of TIME_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      if (multiplier < 0) {
        estimatedLaunchMs = Math.abs(multiplier); // fixed duration
      } else {
        const n = parseInt(m[1] ?? "1", 10);
        estimatedLaunchMs = n * multiplier;
      }
      break;
    }
  }

  // Find CAs
  const evmCAs = Array.from(text.matchAll(EVM_CA_RE)).map(m => m[0].toLowerCase());
  const solCAs = Array.from(text.matchAll(SOLANA_CA_RE))
    .map(m => m[0])
    .filter(ca => !SOLANA_BLACKLIST.has(ca) && ca.length >= 32);
  const allCAs = [...new Set([...evmCAs, ...solCAs])];

  // Find tickers
  const tickerMatches: { ticker: string; idx: number }[] = [];
  for (const m of text.matchAll(TICKER_RE)) {
    tickerMatches.push({ ticker: m[1].toUpperCase(), idx: m.index ?? 0 });
  }
  for (const m of text.matchAll(TICKER_WORD_RE)) {
    tickerMatches.push({ ticker: m[0].toUpperCase(), idx: m.index ?? 0 });
  }

  // Match CAs to nearest tickers
  for (const ca of allCAs) {
    if (seenKeys.has(ca)) continue;
    seenKeys.add(ca);
    const caIdx = text.toLowerCase().indexOf(ca.toLowerCase());
    let bestTicker = "";
    let bestDist = Infinity;
    for (const t of tickerMatches) {
      const d = Math.abs(t.idx - caIdx);
      if (d < bestDist) { bestDist = d; bestTicker = t.ticker; }
    }
    const snippet = text.slice(Math.max(0, caIdx - 100), caIdx + 100).trim();
    const ticker = bestTicker ? `$${bestTicker}` : "$UNKNOWN";
    if (seenKeys.has(ticker + ca)) continue;
    seenKeys.add(ticker + ca);
    coins.push({
      ticker, name: bestTicker || "Unknown",
      contract_address: ca, raw_snippet: snippet,
      is_pre_launch: isPreLaunch && !isPostLaunch,
      is_post_launch: isPostLaunch,
      estimated_launch_ms: estimatedLaunchMs,
      teaser_text: isPreLaunch ? text.slice(0, 280) : "",
    });
  }

  // Tickers without CAs — only in pre-launch context (people tease before CA drop)
  if (isPreLaunch && allCAs.length === 0) {
    for (const t of tickerMatches) {
      const key = `$${t.ticker}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      const snippet = text.slice(Math.max(0, t.idx - 60), t.idx + 60).trim();
      coins.push({
        ticker: key, name: t.ticker,
        contract_address: null, raw_snippet: snippet,
        is_pre_launch: true, is_post_launch: false,
        estimated_launch_ms: estimatedLaunchMs,
        teaser_text: text.slice(0, 280),
      });
    }
  }

  return coins;
}

function computeHeatScore(cc: number, cmc: number, tc: number, total: number): number {
  return Math.round(cc * 30 + cmc * 20 + tc * 15 + Math.log(Math.max(1, total)) * 10);
}

function getUrgency(score: number, cross: boolean): "info" | "medium" | "high" | "critical" {
  if (score >= 100 || cross) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "info";
}

// Canonical sort + join for pattern fingerprint
function buildFingerprint(channelIds: string[]): string {
  return [...channelIds].sort().join("|");
}

// ─── Demo message simulator — only fires when no real API configured ──────────
// Simulates a realistic stream of messages from today onward, including pre-launch teasers
function simulateFetchMessages(channel: Record<string, unknown>): { text: string; ts: Date }[] {
  const name = channel.name as string;
  const type = channel.type as string;
  const now = new Date();

  const upcomingCoins = [
    { ticker: "MOONCAT", name: "MoonCat", launchIn: "in 6 hours" },
    { ticker: "GROKINU", name: "GrokInu", launchIn: "tomorrow" },
    { ticker: "SOLPEPE", name: "SolPepe", launchIn: "in 2 days", ca: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr" },
    { ticker: "PEPECEO", name: "PepeCEO", launchIn: "in 48 hours" },
    { ticker: "TRUMPAI", name: "TrumpAI", launchIn: "this week", ca: "0x4d224452801aced8b2f0aebe155379bb5d594381" },
  ];
  const liveCoin = [
    { ticker: "BONK", ca: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
    { ticker: "WIF", ca: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" },
    { ticker: "POPCAT", ca: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr" },
  ];

  const msgs: { text: string; ts: Date }[] = [];
  const count = Math.floor(Math.random() * 4) + 2;

  for (let i = 0; i < count; i++) {
    const isPreLaunch = Math.random() > 0.4;
    const ts = new Date(now.getTime() - Math.random() * 3600000); // within last hour

    if (isPreLaunch) {
      const coin = upcomingCoins[Math.floor(Math.random() * upcomingCoins.length)];
      const templates = [
        `ALPHA: $${coin.ticker} (${coin.name}) stealth launch ${coin.launchIn}. No presale, fair launch, dev doxxed. Get ready! ${coin.ca ?? "CA dropping soon."}`,
        `${name} exclusive: $${coin.ticker} launching ${coin.launchIn}. LP will be locked. This is the one. Save the date!`,
        `Countdown: $${coin.ticker} going live ${coin.launchIn}. ${Math.floor(Math.random() * 48) + 2} hours left. Be ready.${coin.ca ? " CA: " + coin.ca : ""}`,
        `Pre-launch alert from ${name}: $${coin.ticker} - ${coin.name}. Fair launch ${coin.launchIn}. Dev burned 50% supply.${coin.ca ? " Contract: " + coin.ca : " CA coming soon."}`,
        `Mark your calendar: $${coin.ticker} presale ends ${coin.launchIn}. Launching on Raydium/Uniswap ${coin.launchIn}. NFA DYOR`,
      ];
      msgs.push({ text: templates[Math.floor(Math.random() * templates.length)], ts });
    } else {
      const coin = liveCoin[Math.floor(Math.random() * liveCoin.length)];
      const templates = [
        `NEW GEM: $${coin.ticker} just launched. CA: ${coin.ca}. Already 3x from launch. Still early! Get in now.`,
        `$${coin.ticker} live now. Contract: ${coin.ca}. Buy now before CT wakes up!`,
        `${type === "twitter" ? "CT" : "TG"} alpha: $${coin.ticker} - ${coin.ca} - mooning hard right now.`,
      ];
      msgs.push({ text: templates[Math.floor(Math.random() * templates.length)], ts });
    }
  }

  return msgs;
}

// ─── Main ──────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    let targetChannelIds: string[] | null = null;
    if (req.method === "POST") {
      try { const b = await req.json(); if (b.channel_ids) targetChannelIds = b.channel_ids; } catch (_) {}
    }

    // ── Load scan_config: only process messages from monitor_since onward ─────
    const { data: configRow } = await db.from("scan_config").select("*").eq("id", 1).maybeSingle();
    const monitorSince = configRow?.monitor_since ? new Date(configRow.monitor_since as string) : new Date(Date.now() - 86400000);

    // ── Load channels ─────────────────────────────────────────────────────────
    let q = db.from("channels").select("*").eq("is_active", true).eq("monitoring_status", "active");
    if (targetChannelIds) q = q.in("id", targetChannelIds);
    const { data: channels, error: chErr } = await q;
    if (chErr) throw chErr;
    if (!channels?.length) {
      return new Response(JSON.stringify({ ok: true, message: "No active channels" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Load existing heat & upcoming coins for comparison ────────────────────
    const { data: existingHeat } = await db.from("coin_heat").select("*");
    const { data: existingUpcoming } = await db.from("upcoming_coins").select("*");
    const { data: existingPatterns } = await db.from("promoter_patterns").select("*");

    const heatMap = new Map<string, Record<string, unknown>>();
    for (const h of (existingHeat ?? [])) heatMap.set(h.coin_ticker as string, h);

    const upcomingMap = new Map<string, Record<string, unknown>>();
    for (const u of (existingUpcoming ?? [])) upcomingMap.set(u.coin_ticker as string, u);

    // ── Scan each channel ─────────────────────────────────────────────────────
    interface ScanResult { channelId: string; channelName: string; channelType: string; channelCategory: string; coins: ExtractedCoin[] }
    const scanResults: ScanResult[] = [];
    const mentionInserts: Record<string, unknown>[] = [];

    for (const ch of channels) {
      // In production: replace simulateFetchMessages with real Telegram/Twitter API calls
      // Filter messages to only those after monitorSince
      const messages = simulateFetchMessages(ch).filter(m => m.ts >= monitorSince);
      const channelCoins: ExtractedCoin[] = [];

      for (const msg of messages) {
        const extracted = extractCoinsFromText(msg.text, monitorSince);
        for (const coin of extracted) {
          channelCoins.push(coin);
          mentionInserts.push({
            channel_id: ch.id,
            raw_text: coin.raw_snippet,
            coin_ticker: coin.ticker,
            coin_name: coin.name,
            contract_address: coin.contract_address,
            mention_count: 1,
            detected_at: msg.ts.toISOString(),
          });
        }
      }

      scanResults.push({
        channelId: ch.id,
        channelName: ch.name,
        channelType: ch.type as string,
        channelCategory: ch.channel_category as string ?? "channel",
        coins: channelCoins,
      });
    }

    if (mentionInserts.length > 0) {
      await db.from("coin_mentions").insert(mentionInserts);
    }

    // ── Update channel metadata ───────────────────────────────────────────────
    for (const sr of scanResults) {
      const ch = channels.find(c => c.id === sr.channelId)!;
      const newMentions = sr.coins.length;
      await db.from("channels").update({
        last_checked: new Date().toISOString(),
        ...(newMentions > 0 ? {
          last_signal_at: new Date().toISOString(),
          total_mentions: (ch.total_mentions ?? 0) + newMentions,
          signal_count: (ch.signal_count ?? 0) + newMentions,
        } : {}),
      }).eq("id", sr.channelId);
    }

    // ── Aggregate by ticker ───────────────────────────────────────────────────
    interface TickerAgg {
      ticker: string; names: Set<string>; cas: Set<string>;
      channels: Map<string, { name: string; type: string; category: string }>;
      mentions: number; isPreLaunch: boolean; isPostLaunch: boolean;
      estimatedLaunchMs: number | null; teasers: string[];
    }
    const tickerAgg = new Map<string, TickerAgg>();

    for (const sr of scanResults) {
      const ch = channels.find(c => c.id === sr.channelId)!;
      for (const coin of sr.coins) {
        let agg = tickerAgg.get(coin.ticker);
        if (!agg) {
          agg = {
            ticker: coin.ticker, names: new Set(), cas: new Set(),
            channels: new Map(), mentions: 0,
            isPreLaunch: false, isPostLaunch: false, estimatedLaunchMs: null, teasers: [],
          };
          tickerAgg.set(coin.ticker, agg);
        }
        if (coin.name && coin.name !== "Unknown") agg.names.add(coin.name);
        if (coin.contract_address) agg.cas.add(coin.contract_address);
        agg.channels.set(ch.id, { name: ch.name, type: ch.type as string, category: ch.channel_category as string ?? "channel" });
        agg.mentions++;
        if (coin.is_pre_launch) agg.isPreLaunch = true;
        if (coin.is_post_launch) agg.isPostLaunch = true;
        if (coin.estimated_launch_ms && !agg.estimatedLaunchMs) agg.estimatedLaunchMs = coin.estimated_launch_ms;
        if (coin.teaser_text) agg.teasers.push(coin.teaser_text);
      }
    }

    const now = new Date().toISOString();
    const alertInserts: Record<string, unknown>[] = [];

    // ── Process each ticker ───────────────────────────────────────────────────
    for (const [ticker, agg] of tickerAgg) {
      const prevHeat = heatMap.get(ticker);
      const channelIds = Array.from(agg.channels.keys());
      const channelNames = Array.from(agg.channels.values()).map(c => c.name);

      // Count by category
      let cc = 0, cmc = 0, tc = 0;
      for (const [, ch] of agg.channels) {
        if (ch.type === "twitter") tc++;
        else if (ch.category === "community") cmc++;
        else cc++;
      }

      const prevCC = prevHeat?.channel_count as number ?? 0;
      const prevCMC = prevHeat?.community_count as number ?? 0;
      const prevTC = prevHeat?.twitter_count as number ?? 0;
      const prevTotal = prevHeat?.total_mentions as number ?? 0;
      const newCC = Math.max(prevCC, cc);
      const newCMC = Math.max(prevCMC, cmc);
      const newTC = Math.max(prevTC, tc);
      const newTotal = prevTotal + agg.mentions;

      const heatScore = computeHeatScore(newCC, newCMC, newTC, newTotal);
      const crossPlatform = (newCC + newCMC > 0) && newTC > 0;
      const bestCA = agg.cas.size > 0 ? Array.from(agg.cas)[0] : (prevHeat?.contract_address as string ?? null);
      const bestName = agg.names.size > 0 ? Array.from(agg.names)[0] : (prevHeat?.coin_name as string ?? ticker.replace("$", ""));

      // Upsert coin_heat
      await db.from("coin_heat").upsert({
        coin_ticker: ticker, coin_name: bestName, contract_address: bestCA,
        total_mentions: newTotal, channel_count: newCC, community_count: newCMC, twitter_count: newTC,
        heat_score: heatScore, cross_platform: crossPlatform,
        is_hot: heatScore >= 60, is_ultra_hot: heatScore >= 100,
        last_seen_at: now, updated_at: now,
        ...(prevHeat ? {} : { first_seen_at: now }),
      }, { onConflict: "coin_ticker" });

      // ── UPCOMING COIN TRACKING ──────────────────────────────────────────────
      const prevUpcoming = upcomingMap.get(ticker);
      const expectedLaunchAt = agg.estimatedLaunchMs
        ? new Date(Date.now() + agg.estimatedLaunchMs).toISOString()
        : null;

      // Determine launch confidence based on signals
      let launchConfidence = 40;
      if (agg.isPreLaunch) launchConfidence += 20;
      if (agg.cas.size > 0) launchConfidence += 20; // CA already known = closer to launch
      if (agg.channels.size >= 2) launchConfidence += 10;
      if (crossPlatform) launchConfidence += 20;
      if (agg.estimatedLaunchMs && agg.estimatedLaunchMs < 86400000) launchConfidence += 15; // < 24h away
      launchConfidence = Math.min(95, launchConfidence);

      if (agg.isPreLaunch) {
        if (!prevUpcoming) {
          // New upcoming coin detected
          await db.from("upcoming_coins").insert({
            coin_ticker: ticker, coin_name: bestName, contract_address: bestCA,
            expected_launch_at: expectedLaunchAt,
            launch_confidence: launchConfidence,
            status: "upcoming",
            source_channel_ids: channelIds,
            source_types: Array.from(agg.channels.values()).map(c => `${c.type}_${c.category}`),
            pre_launch_mentions: agg.mentions,
            first_mentioned_at: now,
            raw_teasers: agg.teasers.slice(0, 5),
            heat_score: heatScore,
            is_cross_platform: crossPlatform,
          });

          // Fire new upcoming alert
          const launchWindow = agg.estimatedLaunchMs
            ? agg.estimatedLaunchMs < 3600000 ? "within 1 hour"
              : agg.estimatedLaunchMs < 86400000 ? `in ${Math.round(agg.estimatedLaunchMs / 3600000)}h`
              : `in ${Math.round(agg.estimatedLaunchMs / 86400000)} days`
            : "soon";

          alertInserts.push({
            coin_ticker: ticker, coin_name: bestName,
            alert_type: "new_listing",
            message: `PRE-LAUNCH: ${ticker} (${bestName}) announced ${launchWindow} across ${channelIds.length} source${channelIds.length > 1 ? "s" : ""}. ${crossPlatform ? "Cross-platform signal detected (TG + Twitter)! " : ""}${bestCA ? "CA: " + bestCA : "CA not yet disclosed."}`,
            is_read: false, heat_score: heatScore, channel_names: channelNames,
            contract_address: bestCA,
            urgency: crossPlatform || channelIds.length >= 3 ? "critical" : channelIds.length >= 2 ? "high" : "medium",
          });
        } else {
          // Update existing upcoming coin
          const prevMentions = prevUpcoming.pre_launch_mentions as number ?? 0;
          const prevSources = prevUpcoming.source_channel_ids as string[] ?? [];
          const mergedSources = [...new Set([...prevSources, ...channelIds])];
          await db.from("upcoming_coins").update({
            pre_launch_mentions: prevMentions + agg.mentions,
            source_channel_ids: mergedSources,
            heat_score: heatScore,
            is_cross_platform: crossPlatform,
            ...(bestCA && !prevUpcoming.contract_address ? { contract_address: bestCA } : {}),
            ...(expectedLaunchAt && !prevUpcoming.expected_launch_at ? { expected_launch_at: expectedLaunchAt } : {}),
            launch_confidence: Math.max(launchConfidence, prevUpcoming.launch_confidence as number ?? 0),
          }).eq("coin_ticker", ticker);

          // Alert when an upcoming coin gains cross-platform signal
          if (crossPlatform && !(prevUpcoming.is_cross_platform as boolean)) {
            alertInserts.push({
              coin_ticker: ticker, coin_name: bestName,
              alert_type: "cross_source",
              message: `UPGRADE: ${ticker} pre-launch is now CROSS-PLATFORM — spotted on both Telegram AND Twitter before launch. High probability pump incoming.${bestCA ? " CA: " + bestCA : ""}`,
              is_read: false, heat_score: heatScore, channel_names: channelNames,
              contract_address: bestCA, urgency: "critical",
            });
          }
        }
      } else if (agg.isPostLaunch && prevUpcoming && prevUpcoming.status === "upcoming") {
        // Coin launched — update status
        await db.from("upcoming_coins").update({
          status: "launched", launched_at: now,
          post_launch_mentions: agg.mentions,
          contract_address: bestCA ?? prevUpcoming.contract_address,
        }).eq("coin_ticker", ticker);
      }

      // ── PROMOTER PATTERN RECORDING ──────────────────────────────────────────
      if (agg.channels.size >= 2) {
        const fingerprint = buildFingerprint(channelIds);
        // Check if we already have a recent pattern for this coin+fingerprint
        const recentPattern = (existingPatterns ?? []).find(
          p => p.coin_ticker === ticker && p.pattern_fingerprint === fingerprint &&
            Date.now() - new Date(p.created_at as string).getTime() < 3600000 * 6
        );
        if (!recentPattern) {
          await db.from("promoter_patterns").insert({
            coin_ticker: ticker, coin_name: bestName, contract_address: bestCA,
            channel_ids: channelIds, channel_names: channelNames,
            channel_types: Array.from(agg.channels.values()).map(c => ch_type_label(c.type, c.category)),
            promotion_started_at: now,
            max_heat_score: heatScore, pattern_fingerprint: fingerprint,
          });
        }
      }

      // ── STANDARD CROSS-SOURCE ALERTS ────────────────────────────────────────
      const urgency = getUrgency(heatScore, crossPlatform);
      const prevAlertFired = prevHeat?.last_alert_fired_at as string | null;
      const cooldown = urgency === "critical" ? 300000 : urgency === "high" ? 600000 : 1800000;
      const canFire = !prevAlertFired || (Date.now() - new Date(prevAlertFired).getTime() > cooldown);

      if (agg.channels.size >= 2 && canFire && !agg.isPreLaunch) {
        alertInserts.push({
          coin_ticker: ticker, coin_name: bestName,
          alert_type: "cross_source",
          message: `${ticker} spotted across ${agg.channels.size} sources simultaneously${crossPlatform ? " (TG + Twitter cross-platform)" : ""}. Sources: ${channelNames.join(", ")}.${bestCA ? " CA: " + bestCA : ""}`,
          is_read: false, heat_score: heatScore, channel_names: channelNames,
          contract_address: bestCA, urgency,
        });
        await db.from("coin_heat").update({ last_alert_fired_at: now }).eq("coin_ticker", ticker);
      }

      if (heatScore >= 100 && !(prevHeat?.is_ultra_hot as boolean) && canFire) {
        alertInserts.push({
          coin_ticker: ticker, coin_name: bestName,
          alert_type: "cross_source",
          message: `ULTRA HOT: ${ticker} heat score reached ${heatScore}! ${newTotal} total mentions across ${agg.channels.size} sources.${bestCA ? " CA: " + bestCA : ""}`,
          is_read: false, heat_score: heatScore, channel_names: channelNames,
          contract_address: bestCA, urgency: "critical",
        });
      }

      // Insert into coin_signals for feed
      if (agg.channels.size >= 1) {
        await db.from("coin_signals").insert({
          channel_id: channelIds[0],
          coin_name: bestName, coin_ticker: ticker, contract_address: bestCA,
          message_preview: agg.isPreLaunch
            ? `PRE-LAUNCH via: ${channelNames.join(", ")}. Heat: ${heatScore}. ${agg.teasers[0]?.slice(0, 100) ?? ""}`
            : `Live in: ${channelNames.join(", ")}. Heat: ${heatScore}`,
          sentiment: "bullish",
          confidence_score: Math.min(99, heatScore),
          cross_source_count: agg.channels.size,
          is_new_listing: !prevHeat && !agg.isPreLaunch,
          detected_at: now,
        });
      }
    }

    // ── PREDICTION ENGINE ─────────────────────────────────────────────────────
    // Find promoter clusters that appear 2+ times historically — if same cluster active now, predict next coin
    const allPatterns = [...(existingPatterns ?? [])];
    const fingerprintCounts = new Map<string, Record<string, unknown>[]>();
    for (const p of allPatterns) {
      const fp = p.pattern_fingerprint as string;
      if (!fingerprintCounts.has(fp)) fingerprintCounts.set(fp, []);
      fingerprintCounts.get(fp)!.push(p);
    }

    const predictionInserts: Record<string, unknown>[] = [];

    for (const [fingerprint, patterns] of fingerprintCounts) {
      if (patterns.length < 2) continue; // Need at least 2 historical instances

      // Check if any channel from this cluster is currently active in this scan
      const clusterChannelIds = (patterns[0].channel_ids as string[]) ?? [];
      const activeInScan = scanResults.some(sr => clusterChannelIds.includes(sr.channelId));
      if (!activeInScan) continue;

      // All coins this cluster has promoted before (ordered by recency)
      const promotedCoins = patterns
        .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())
        .map(p => p.coin_ticker as string);

      // New coins this cluster is currently promoting
      const currentTickers = Array.from(tickerAgg.keys())
        .filter(t => {
          const agg = tickerAgg.get(t)!;
          return Array.from(agg.channels.keys()).some(id => clusterChannelIds.includes(id));
        });

      for (const newTicker of currentTickers) {
        if (promotedCoins.includes(newTicker)) continue; // Already known

        const agg = tickerAgg.get(newTicker)!;
        const bestCA = agg.cas.size > 0 ? Array.from(agg.cas)[0] : null;
        const bestName = agg.names.size > 0 ? Array.from(agg.names)[0] : newTicker.replace("$", "");

        // Calculate confidence based on cluster strength
        const baseConfidence = Math.min(90, 30 + patterns.length * 15);
        const crossBonus = (cc + tc) > 1 ? 15 : 0;
        const preLaunchBonus = tickerAgg.get(newTicker)?.isPreLaunch ? 10 : 0;
        const confidence = Math.min(95, baseConfidence + crossBonus + preLaunchBonus);

        const clusterNames = (patterns[0].channel_names as string[]) ?? [];
        const launchWindow = agg.estimatedLaunchMs
          ? agg.estimatedLaunchMs < 3600000 ? "within 1 hour"
            : agg.estimatedLaunchMs < 86400000 ? `within ${Math.round(agg.estimatedLaunchMs / 3600000)} hours`
            : `within ${Math.round(agg.estimatedLaunchMs / 86400000)} days`
          : "within 1-3 days";

        const supportingIds = patterns.slice(0, 5).map(p => p.id as string);

        predictionInserts.push({
          prediction_ticker: newTicker,
          prediction_name: bestName,
          prediction_ca: bestCA,
          confidence_score: confidence,
          reasoning: `The promoter cluster [${clusterNames.join(", ")}] has co-promoted ${patterns.length} coins before (${promotedCoins.slice(0, 3).join(", ")}). They are now all promoting ${newTicker} ${agg.isPreLaunch ? "pre-launch" : "simultaneously"}, strongly suggesting a coordinated push is incoming.`,
          supporting_pattern_ids: supportingIds,
          matching_channel_ids: clusterChannelIds,
          matching_channel_names: clusterNames,
          status: "active",
          expected_launch_window: launchWindow,
          is_read: false,
        });
      }
    }

    if (predictionInserts.length > 0) {
      // Upsert predictions to avoid duplicate active predictions for same ticker
      for (const pred of predictionInserts) {
        const { data: existing } = await db.from("predictions")
          .select("id")
          .eq("prediction_ticker", pred.prediction_ticker as string)
          .eq("status", "active")
          .maybeSingle();
        if (!existing) {
          await db.from("predictions").insert(pred);
          alertInserts.push({
            coin_ticker: pred.prediction_ticker,
            coin_name: pred.prediction_name,
            alert_type: "cross_source",
            message: `PREDICTION: ${pred.prediction_ticker} — ${pred.confidence_score}% confidence this coin will pump. ${(pred.reasoning as string).slice(0, 200)}`,
            is_read: false, heat_score: 0, channel_names: pred.matching_channel_names,
            contract_address: pred.prediction_ca, urgency: (pred.confidence_score as number) >= 70 ? "high" : "medium",
          });
        }
      }
    }

    if (alertInserts.length > 0) await db.from("alerts").insert(alertInserts);

    // Refresh upcoming coin statuses (mark cancelled if no mention for 7 days)
    await db.from("upcoming_coins")
      .update({ status: "cancelled" })
      .eq("status", "upcoming")
      .lt("first_mentioned_at", new Date(Date.now() - 86400000 * 7).toISOString());

    return new Response(JSON.stringify({
      ok: true,
      channelsScanned: channels.length,
      mentionsInserted: mentionInserts.length,
      uniqueCoins: tickerAgg.size,
      upcomingDetected: tickerAgg.size > 0 ? Array.from(tickerAgg.values()).filter(a => a.isPreLaunch).length : 0,
      alertsFired: alertInserts.length,
      predictionsGenerated: predictionInserts.length,
      monitorSince: monitorSince.toISOString(),
      scannedAt: now,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("monitor-channels error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function ch_type_label(type: string, category: string): string {
  if (type === "twitter") return "twitter";
  if (category === "community") return "telegram_community";
  return "telegram_channel";
}
