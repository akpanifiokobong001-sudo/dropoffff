import { Router } from 'express'
import { estimateAll, estimatePrice } from '../pricing.js'
import { isValidCountry } from '../countries.js'
import { hasStates, isValidState } from '../states.js'

const router = Router()

// POST /api/quotes  { fromCode, toCode, fromState?, toState?, weightKg, service? }
// Returns all service tiers (or one, if `service` given) — matches the frontend quote screen.
router.post('/', (req, res) => {
  const { fromCode, toCode, fromState, toState, weightKg, service } = req.body || {}

  if (!isValidCountry(fromCode)) return res.status(400).json({ error: 'Invalid origin country code' })
  if (!isValidCountry(toCode)) return res.status(400).json({ error: 'Invalid destination country code' })

  // States are optional, but if given (or required by the country) they must be valid.
  if (fromState && !isValidState(fromCode, fromState)) return res.status(400).json({ error: 'Invalid origin state' })
  if (toState && !isValidState(toCode, toState)) return res.status(400).json({ error: 'Invalid destination state' })
  if (hasStates(fromCode) && !fromState) return res.status(400).json({ error: 'Origin state is required' })
  if (hasStates(toCode) && !toState) return res.status(400).json({ error: 'Destination state is required' })

  const w = Number(weightKg)
  if (!Number.isFinite(w) || w <= 0 || w > 1000) {
    return res.status(400).json({ error: 'Weight must be a positive number (kg)' })
  }

  if (service) {
    return res.json({ quote: estimatePrice({ fromCode, toCode, fromState, toState, weightKg: w, service }) })
  }
  return res.json({ quotes: estimateAll({ fromCode, toCode, fromState, toState, weightKg: w }) })
})

export default router
