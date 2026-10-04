export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const callsign = String(req.query.callsign || '').trim().toUpperCase();
  const type = String(req.query.type || 'arrival').toLowerCase();
  if (!/^[A-Z0-9 -]{2,12}$/.test(callsign) || !['arrival', 'departure'].includes(type)) {
    return res.status(400).json({ ok: false, error: 'Invalid callsign or flight type.' });
  }

  const key = process.env.FLIGHTAWARE_API_KEY;
  if (!key) return res.status(503).json({ ok: false, configured: false, error: 'Live provider is not configured yet.' });

  const apiBase = 'https://aeroapi.flightaware.com/aeroapi/';
  const headers = { 'x-apikey': key, 'Accept': 'application/json' };

  async function getJSON(path) {
    const response = await fetch(apiBase + path, { headers, cache: 'no-store' });
    const raw = await response.text();
    let data = null;
    try { data = JSON.parse(raw); } catch {}
    if (!response.ok) {
      const providerMessage = data?.error || data?.message || data?.detail || ('HTTP ' + response.status);
      const error = new Error(String(providerMessage));
      error.status = response.status;
      throw error;
    }
    return data || {};
  }

  const cleanIdent = value => String(value || '').replace(/\s+/g, '').toUpperCase();
  const airportCode = value => {
    if (!value) return '';
    if (typeof value === 'string') return cleanIdent(value);
    return cleanIdent(value.code_icao || value.code || value.code_iata || value.code_lid);
  };
  const gateFor = f => {
    const gate = type === 'departure' ? f.gate_origin : f.gate_destination;
    return typeof gate === 'string' && gate.trim() ? gate.trim().toUpperCase() : null;
  };
  const matchesCallsign = f => [f.ident_icao, f.ident_iata, f.ident, f.atc_ident].map(cleanIdent).includes(cleanIdent(callsign));
  const matchesKBOS = f => {
    const o = airportCode(f.origin_icao || f.origin_iata || f.origin);
    const d = airportCode(f.destination_icao || f.destination_iata || f.destination);
    return type === 'departure' ? o === 'KBOS' : d === 'KBOS';
  };
  const makeResult = (f, gate) => ({
    ok: true, found: true, provider: 'FlightAware',
    callsign: f.ident_icao || f.ident || callsign, gate,
    terminal: type === 'departure' ? (f.terminal_origin || null) : (f.terminal_destination || null),
    status: f.status || null,
    scheduled: type === 'departure' ? (f.scheduled_out || null) : (f.scheduled_in || null),
    estimated: type === 'departure' ? (f.estimated_out || null) : (f.estimated_in || null),
    actual: type === 'departure' ? (f.actual_out || null) : (f.actual_in || null),
    origin: f.origin_icao || f.origin_iata || airportCode(f.origin) || null,
    destination: f.destination_icao || f.destination_iata || airportCode(f.destination) || null
  });

  try {
    const ident = cleanIdent(callsign);

    // 1. Direct flight lookup: best source for a specific flight and its actual gate.
    const direct = await getJSON('flights/' + encodeURIComponent(ident) + '?max_pages=1');
    const directFlights = Array.isArray(direct.flights) ? direct.flights : [];
    const directMatch = directFlights.map(f => ({ f, gate: gateFor(f) })).find(x => matchesCallsign(x.f) && matchesKBOS(x.f) && x.gate);
    if (directMatch) return res.status(200).json(makeResult(directMatch.f, directMatch.gate));

    // 2. Future scheduled traffic. Do not send start/end: the endpoint itself is
    // already scoped to future scheduled flights, and this avoids provider-specific
    // start-bound validation issues.
    const board = type === 'departure' ? 'scheduled_departures' : 'scheduled_arrivals';
    const scheduled = await getJSON('airports/KBOS/flights/' + board + '?max_pages=1');
    const scheduledFlights = scheduled.flights || scheduled.arrivals || scheduled.departures || [];
    const scheduledMatch = (Array.isArray(scheduledFlights) ? scheduledFlights : [])
      .map(f => ({ f, gate: gateFor(f) }))
      .find(x => matchesCallsign(x.f) && matchesKBOS(x.f) && x.gate);
    if (scheduledMatch) return res.status(200).json(makeResult(scheduledMatch.f, scheduledMatch.gate));

    // 3. Recent airport traffic: covers flights that already operated.
    const recentBoard = type === 'departure' ? 'departures' : 'arrivals';
    const recent = await getJSON('airports/KBOS/flights/' + recentBoard + '?max_pages=1');
    const recentFlights = recent.flights || recent.arrivals || recent.departures || [];
    const recentMatch = (Array.isArray(recentFlights) ? recentFlights : [])
      .map(f => ({ f, gate: gateFor(f) }))
      .find(x => matchesCallsign(x.f) && matchesKBOS(x.f) && x.gate);
    if (recentMatch) return res.status(200).json(makeResult(recentMatch.f, recentMatch.gate));

    return res.status(200).json({ ok: true, found: false, provider: 'FlightAware', message: 'FlightAware found the flight, but its KBOS gate is currently null or unavailable.' });
  } catch (error) {
    const status = Number(error.status) || 502;
    return res.status(status >= 400 && status < 600 ? status : 502).json({ ok: false, provider: 'FlightAware', error: String(error.message || 'FlightAware request failed.') });
  }
}