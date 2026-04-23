// api/stripe-checkout.js
// Creates Stripe checkout sessions for subscription upgrades

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  const { userId, email, tier, referralCode } = req.body
  if (!userId || !email || !tier) return res.status(400).json({ error: 'userId, email, tier required' })

  const PLANS = {
    core: { priceId: process.env.STRIPE_CORE_PRICE_ID, name: 'The Framework Core', amount: 999 },
    pro: { priceId: process.env.STRIPE_PRO_PRICE_ID, name: 'The Framework Pro', amount: 1999 },
  }

  const plan = PLANS[tier]
  if (!plan) return res.status(400).json({ error: 'Invalid tier' })

  const baseUrl = process.env.DASHBOARD_URL || 'https://the-framework-one.vercel.app'

  try {
    const sessionBody = {
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{
        price: plan.priceId,
        quantity: 1
      }],
      success_url: `${baseUrl}/dashboard?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard?upgrade=cancelled`,
      metadata: { userId, tier, referralCode: referralCode || '' },
      subscription_data: {
        metadata: { userId, tier },
        trial_period_days: 7
      },
      allow_promotion_codes: true,
    }

    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(flattenStripeObject(sessionBody)).toString()
    })

    const session = await r.json()
    if (session.error) throw new Error(session.error.message)

    return res.status(200).json({ url: session.url, sessionId: session.id })
  } catch (e) {
    console.error('Stripe error:', e)
    return res.status(500).json({ error: e.message })
  }
}

function flattenStripeObject(obj, prefix = '') {
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === 'object') {
          Object.assign(result, flattenStripeObject(item, `${fullKey}[${i}]`))
        } else {
          result[`${fullKey}[${i}]`] = item
        }
      })
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenStripeObject(value, fullKey))
    } else if (value !== undefined && value !== null) {
      result[fullKey] = String(value)
    }
  }
  return result
}
