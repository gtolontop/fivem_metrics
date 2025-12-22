var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// index.ts
async function fetchIp(serverId) {
  try {
    const res = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${serverId}`, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (res.status === 429) return { serverId, ip: null, error: "rate_limited" };
    if (!res.ok) return { serverId, ip: null, error: `http_${res.status}` };
    const data = await res.json();
    return { serverId, ip: data.Data?.connectEndPoints?.[0] || null };
  } catch (e) {
    return { serverId, ip: null, error: String(e) };
  }
}
__name(fetchIp, "fetchIp");
async function scanServer(serverId, ip) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5e3);
    const res = await fetch(`http://${ip}/info.json`, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    clearTimeout(timeout);
    if (!res.ok) return { serverId, ip, online: false, error: `http_${res.status}` };
    const data = await res.json();
    return {
      serverId,
      ip,
      online: true,
      resources: data.resources || [],
      players: data.vars?.sv_maxClients ? parseInt(data.vars.sv_maxClients) : 0
    };
  } catch (e) {
    return { serverId, ip, online: false, error: String(e) };
  }
}
__name(scanServer, "scanServer");
async function doWork(env, preferType) {
  try {
    const workRes = await fetch(`${env.API_BASE}/api/queue/work?worker=cloudflare&type=${preferType}`);
    if (!workRes.ok) {
      return { tasks: 0, ipSuccess: 0, ipFailed: 0, scanOnline: 0, scanOffline: 0, error: `http_${workRes.status}` };
    }
    const workData = await workRes.json();
    if (!workData.tasks?.length) {
      return { tasks: 0, ipSuccess: 0, ipFailed: 0, scanOnline: 0, scanOffline: 0 };
    }
    const ipTasks = workData.tasks.filter((t) => t.type === "ip_fetch");
    const scanTasks = workData.tasks.filter((t) => t.type === "scan");
    let ipSuccess = 0, ipFailed = 0, scanOnline = 0, scanOffline = 0;
    if (ipTasks.length > 0) {
      const ipResults = await Promise.all(ipTasks.map((t) => fetchIp(t.serverId)));
      ipSuccess = ipResults.filter((r) => r.ip !== null).length;
      ipFailed = ipResults.length - ipSuccess;
      await fetch(`${env.API_BASE}/api/queue/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ip_results", results: ipResults, workerId: "cloudflare" })
      });
    }
    if (scanTasks.length > 0) {
      const scanResults = await Promise.all(
        scanTasks.filter((t) => t.ip).map((t) => scanServer(t.serverId, t.ip))
      );
      scanOnline = scanResults.filter((r) => r.online).length;
      scanOffline = scanResults.length - scanOnline;
      await fetch(`${env.API_BASE}/api/queue/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "scan_results", results: scanResults, workerId: "cloudflare" })
      });
    }
    return { tasks: workData.count, ipSuccess, ipFailed, scanOnline, scanOffline };
  } catch (e) {
    return { tasks: 0, ipSuccess: 0, ipFailed: 0, scanOnline: 0, scanOffline: 0, error: String(e) };
  }
}
__name(doWork, "doWork");
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return new Response("OK");
    }
    if (url.pathname === "/work") {
      const preferType = url.searchParams.get("type") || "ip_fetch";
      const startTime = Date.now();
      const result = await doWork(env, preferType);
      return Response.json({ ...result, timeMs: Date.now() - startTime });
    }
    if (url.pathname === "/rapid") {
      const rounds = Math.min(parseInt(url.searchParams.get("rounds") || "3"), 5);
      const preferType = url.searchParams.get("type") || "ip_fetch";
      const startTime = Date.now();
      const totals = { tasks: 0, ipSuccess: 0, ipFailed: 0, scanOnline: 0, scanOffline: 0 };
      const details = [];
      for (let i = 0; i < rounds; i++) {
        const result = await doWork(env, preferType);
        details.push({ round: i, ...result });
        totals.tasks += result.tasks;
        totals.ipSuccess += result.ipSuccess;
        totals.ipFailed += result.ipFailed;
        totals.scanOnline += result.scanOnline;
        totals.scanOffline += result.scanOffline;
      }
      return Response.json({
        mode: "rapid",
        rounds,
        totals,
        details,
        timeMs: Date.now() - startTime
      });
    }
    return Response.json({
      name: "FiveM Metrics Worker",
      endpoints: ["/work", "/rapid?rounds=3", "/health"],
      apiBase: env.API_BASE
    });
  },
  // Cron: run every minute
  async scheduled(event, env, ctx) {
    ctx.waitUntil(doWork(env, "ip_fetch"));
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
