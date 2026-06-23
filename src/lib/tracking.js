// Mock tracking generator for DropOff.
// Deterministically turns a tracking number into a believable shipment timeline.

const STAGES = [
  { key: 'created', label: 'Label created', detail: 'Shipment registered and label generated' },
  { key: 'pickup', label: 'Picked up', detail: 'Collected from sender' },
  { key: 'origin', label: 'At origin facility', detail: 'Processed at origin sorting hub' },
  { key: 'transit', label: 'In transit', detail: 'On the move toward destination country' },
  { key: 'customs', label: 'Customs clearance', detail: 'Clearing international customs' },
  { key: 'destination', label: 'At destination facility', detail: 'Arrived at local delivery hub' },
  { key: 'out', label: 'Out for delivery', detail: 'With courier for final delivery' },
  { key: 'delivered', label: 'Delivered', detail: 'Delivered to recipient' },
]

// Simple deterministic hash so the same tracking number always yields the same result.
function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

const CITIES = [
  'London, UK', 'Frankfurt, DE', 'Dubai, AE', 'Singapore, SG',
  'New York, US', 'São Paulo, BR', 'Lagos, NG', 'Sydney, AU',
  'Tokyo, JP', 'Mumbai, IN', 'Nairobi, KE', 'Toronto, CA',
]

// Returns a tracking object: current stage index + a timeline of events.
export function getTracking(trackingNumber) {
  const clean = (trackingNumber || '').trim().toUpperCase()
  if (!clean) return null

  const h = hash(clean)
  // How far along is the shipment (1..STAGES.length)
  const currentIndex = h % STAGES.length
  const originCity = CITIES[h % CITIES.length]
  const hubCity = CITIES[(h >> 3) % CITIES.length]
  const destCity = CITIES[(h >> 6) % CITIES.length]

  const places = [originCity, originCity, originCity, hubCity, hubCity, destCity, destCity, destCity]

  const timeline = STAGES.map((stage, i) => ({
    ...stage,
    place: places[i],
    // Days ago, counting down so earlier stages are further in the past
    daysAgo: Math.max(0, currentIndex - i),
    done: i <= currentIndex,
    current: i === currentIndex,
  }))

  const delivered = currentIndex >= STAGES.length - 1

  return {
    trackingNumber: clean,
    origin: originCity,
    destination: destCity,
    delivered,
    currentIndex,
    currentStage: STAGES[currentIndex],
    progress: Math.round(((currentIndex + 1) / STAGES.length) * 100),
    timeline,
  }
}

// A few sample tracking numbers users can try on the Track page.
export const SAMPLE_TRACKING = ['DROP-7X4K-2291', 'DROP-A18B-7740', 'DROP-QZ09-5512']
