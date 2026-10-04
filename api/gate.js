export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const callsign = String(req.query.callsign || '').trim().toUpperCase();
  const type = String(req.query.type || 'arrival').toLowerCase();

  if (!/^[A-Z0-9 -]{2,12}$/.test(callsign)) {
    return res.status(400).json({ ok: false, error: 'Invalid callsign.' });
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
    const url = 'https://aeroapi.flightaware.com/aeroapi/flights/' +
      encodeURIComponent(callsign.replace(/\s+/g, ''));

    const response = await fetch(url, {
      headers: { 'x-apikey': key, 'Accept': 'application/json' }
    });

    if (!response.ok) {
      const body = await response.text();
      return res.status(response.status).json({
        ok: false,
        provider: 'FlightAware',
        error: body || 'FlightAware request failed.'
      });
    }

    const data = await response.json();
    const flights = Array.isArray(data.flights) ? data.flights : [];

    const bos = flights.filter(f => {
      const destination = f.destination?.code || f.destination?.code_icao || f.destination;
      const origin = f.origin?.code || f.origin?.code_icao || f.origin;
      return type === 'departure' ? String(origin || '').toUpperCase() === 'KBOS'
        : String(destination || '').toUpperCase() === 'KBOS';
    });

    const gateField = type === 'departure' ? 'gate_origin' : 'gate_destination';
    const timeField = type === 'departure' ? 'scheduled_out' : 'scheduled_in';

    const withGates = bos
      .filter(f => f[gateField])
      .sort((a, b) => String(b[timeField] || '').localeCompare(String(a[timeField] || '')));

    const flight = withGates[0];

    if (!flight) {
      return res.status(200).json({
        ok: true,
        found: false,
        provider: 'FlightAware',
        message: 'No verified KBOS gate was returned for this flight.'
      });
    }

    return res.status(200).json({
      ok: true,
      found: true,
      provider: 'FlightAware',
      callsign: flight.ident_icao || flight.ident || callsign,
      gate: String(flight[gateField]).trim().toUpperCase(),
      terminal: flight.terminal_destination || flight.terminal_origin || null,
      status: flight.status || null,
      scheduled: flight[timeField] || null,
      origin: flight.origin?.code_icao || flight.origin?.code || null,
      destination: flight.destination?.code_icao || flight.destination?.code || null
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      provider: 'FlightAware',
      error: 'Live provider request failed.'
    });
  }
}
