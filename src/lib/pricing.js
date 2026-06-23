// Mock pricing engine for DropOff.
// NOTE: This is a frontend-only estimate. Real carrier rates would come from a backend.

import { countryByCode } from '../data/countries.js'

// Coarse geographic adjacency used to derive a "distance tier" between two regions.
// 0 = same region (cheapest), higher = farther / more expensive.
const REGION_DISTANCE = {
  europe: { europe: 0, mideast: 1, africa: 2, asia: 2, americas: 3, oceania: 4 },
  mideast: { mideast: 0, europe: 1, africa: 1, asia: 1, americas: 3, oceania: 3 },
  africa: { africa: 0, mideast: 1, europe: 2, asia: 3, americas: 3, oceania: 4 },
  asia: { asia: 0, mideast: 1, europe: 2, oceania: 2, africa: 3, americas: 3 },
  americas: { americas: 0, europe: 3, mideast: 3, africa: 3, asia: 3, oceania: 4 },
  oceania: { oceania: 0, asia: 2, mideast: 3, europe: 4, africa: 4, americas: 4 },
}

// Service tiers: base multiplier and delivery window (business days) per distance tier.
export const SERVICES = {
  economy: {
    key: 'economy',
    name: 'Economy',
    tagline: 'Best value, no rush',
    multiplier: 1,
    days: [2, 3, 5, 7, 10, 14],
  },
  express: {
    key: 'express',
    name: 'Express',
    tagline: 'The everyday favorite',
    multiplier: 1.7,
    days: [1, 2, 3, 4, 6, 8],
  },
  priority: {
    key: 'priority',
    name: 'Priority',
    tagline: 'Fastest, fully tracked',
    multiplier: 2.6,
    days: [1, 1, 2, 2, 3, 4],
  },
}

export function distanceTier(fromCode, toCode) {
  const from = countryByCode[fromCode]
  const to = countryByCode[toCode]
  if (!from || !to) return 3
  if (from.code === to.code) return 0
  return REGION_DISTANCE[from.region]?.[to.region] ?? 3
}

// Inter-state delivery surcharge. Door-to-door delivery into a specific state /
// province adds dedicated pickup and last-mile routing on top of the country-to-
// country rate, and crossing state lines adds a further inter-state transfer leg.
// Returns 0 when no states are involved, so country-only routes are unaffected.
export function stateSurcharge(fromCode, toCode, fromState, toState) {
  let s = 0
  if (fromState) s += 24 // origin-state pickup routing
  if (toState) s += 30 // destination-state last-mile delivery
  // A dedicated inter-state transfer leg whenever origin and destination aren't
  // the exact same place (different states, or different countries entirely).
  const sameSpot = fromCode === toCode && fromState && fromState === toState
  if (fromState && toState && !sameSpot) s += 45
  return s
}

// Returns a price estimate in USD for the given route, weight and service.
export function estimatePrice({ fromCode, toCode, fromState, toState, weightKg = 1, service = 'express' }) {
  const tier = distanceTier(fromCode, toCode)
  const svc = SERVICES[service] || SERVICES.express

  const base = 35 // premium handling / pickup
  const distanceCost = tier * 28 // each region tier adds substantial cost
  const weightCost = Math.max(0, weightKg) * (12 + tier * 5)
  const interStateCost = stateSurcharge(fromCode, toCode, fromState, toState)
  const fuelAndCustoms = (base + distanceCost + weightCost + interStateCost) * 0.18

  const subtotal = (base + distanceCost + weightCost + interStateCost + fuelAndCustoms) * svc.multiplier
  const price = Math.round(subtotal * 100) / 100

  const days = svc.days[Math.min(tier, svc.days.length - 1)]

  return {
    tier,
    service: svc.key,
    serviceName: svc.name,
    price,
    currency: 'USD',
    etaDays: days,
    breakdown: {
      base: round2(base * svc.multiplier),
      distance: round2(distanceCost * svc.multiplier),
      weight: round2(weightCost * svc.multiplier),
      interState: round2(interStateCost * svc.multiplier),
      fees: round2(fuelAndCustoms * svc.multiplier),
    },
  }
}

// Estimate across all three service tiers at once (used on the result screen).
export function estimateAll({ fromCode, toCode, fromState, toState, weightKg }) {
  return Object.keys(SERVICES).map((service) =>
    estimatePrice({ fromCode, toCode, fromState, toState, weightKg, service }),
  )
}

function round2(n) {
  return Math.round(n * 100) / 100
}

export function formatPrice(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}
