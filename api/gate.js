export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const callsign = String(req.query.callsign || '').trim().toUpperCase();
  const type = String(req.query.type || 'arrival').toLowerCase();

  if (!/^[A-Z0-9 -]{2,12}$/.test(callsign) || !['arrival', 'departure'].includes(type)) {
    return res.status(400).json({ ok: false, error: 'Invalid callsign or flight type.' });
  }

  const key = process.env.FLIGHTAWARE_API_KEY;
  if (!key) {
    return res.status(503).json({
      ok: false,
      configured: false,
      error: 'Live provider is not configured yet.'
    });
  }

  try {
    const ident = callsign.replace(/\s+/g, '');
    const url = 'https://aeroapi.flightaware.com/aeroapi/flights/' + encodeURIComponent(ident) + '?max_pages=1';

    const response = await fetch(url, {
      headers: {
        'x-apikey': key,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        provider: 'FlightAware',
        error: response.status === 401 || response.status === 403
          ? 'FlightAware credentials or plan do not permit this request.'
          : 'FlightAware did not return a successful response.'
      });
    }

    const data = await response.json();
    const flights = Array.isArray(data.flights) ? data.flights : [];

    const candidates = flights
      .filter(f => {
        const origin = String(f.origin_icao || f.origin_iata || f.origin || '').toUpperCase();
        const destination = String(f.destination_icao || f.destination_iata || f.destination || '').toUpperCase();
        const gate = type === 'departure' ? f.gate_origin : f.gate_destination;
        return (type === 'departure' ? origin === 'KBOS' : destination === 'KBOS') &&
          typeof gate === 'string' && gate.trim().length > 0;
      })
      .sort((a, b) => {
        const ta = Date.parse(a.estimated_in || a.scheduled_in || a.estimated_out || a.scheduled_out || '') || 0;
        const tb = Date.parse(b.estimated_in || b.scheduled_in || b.estimated_out || b.scheduled_out || '') || 0;
        return Math.abs(ta - Date.now()) - Math.abs(tb - Date.now());
      });

    const flight = candidates[0];

    if (!flight) {
      return res.status(200).json({
        ok: true,
        found: false,
        provider: 'FlightAware',
        message: 'No verified KBOS gate is currently available for this flight.'
      });
    }

    const gate = String(type === 'departure' ? flight.gate_origin : flight.gate_destination)
      .trim()
      .toUpperCase();

    return res.status(200).json({
      ok: true,
      found: true,
      provider: 'FlightAware',
      callsign: flight.ident_icao || flight.ident || ident,
      gate,
      terminal: type === 'departure' ? (flight.terminal_origin || null) : (flight.terminal_destination || null),
      status: flight.status || null,
      scheduled: type === 'departure' ? (flight.scheduled_out || null) : (flight.scheduled_in || null),
      estimated: type === 'departure' ? (flight.estimated_out || null) : (flight.estimated_in || null),
      origin: flight.origin_icao || flight.origin_iata || null,
      destination: flight.destination_icao || flight.destination_iata || null
    });
  } catch {
    return res.status(502).json({
      ok: false,
      provider: 'FlightAware',
      error: 'Live provider request failed.'
    });
  }
}
