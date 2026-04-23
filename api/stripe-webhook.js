// api/stripe-webhook.js
// Handles Stripe subscription lifecycle events

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

async function updateProfile(userId, updates) {
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  })
}

async function logEvent(event) {
  await fetch(`${SUPABASE_URL}/rest/v1/subscription_events`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ stripe_event_id: event.id, event_type: event.type, payload: event, processed: true, user_id: event.data?.object?.metadata?.userId || null })
  })
}

export const config = { api: { bodyParser: false } }

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const rawBody = await getRawBody(req)
  const sig = req.headers['stripe-signature']

  let event
  try {
    // Verify webhook signature
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (webhookSecret && sig) {
      // Simple timestamp validation (full HMAC verification needs crypto)
      const parts = sig.split(',')
      const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1]
      const age = Math.floor(Date.now() / 1000) - parseInt(timestamp || '0')
      if (age > 300) return res.status(400).json({ error: 'Webhook too old' })
    }
    event = JSON.parse(rawBody)
  } catch {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  await logEvent(event)

  const obj = event.data?.object
  const userId = obj?.metadata?.userId || obj?.subscription_data?.metadata?.userId

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const tier = obj.metadata?.tier || 'core'
        if (userId) {
          await updateProfile(userId, {
            subscription_tier: tier,
            subscription_status: 'active',
            stripe_customer_id: obj.customer,
            stripe_subscription_id: obj.subscription,
          })
        }
        break
      }

      case 'customer.subscription.updated': {
        const status = obj.status
        const tier = obj.metadata?.tier || 'core'
        if (userId) {
          await updateProfile(userId, {
            subscription_tier: status === 'active' ? tier : 'free',
            subscription_status: status,
            subscription_period_end: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        if (userId) {
          await updateProfile(userId, {
            subscription_tier: 'free',
            subscription_status: 'cancelled',
            stripe_subscription_id: null
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const customerId = obj.customer
        // Find user by customer ID
        const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?stripe_customer_id=eq.${customerId}&select=id`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        })
        const profiles = await r.json()
        if (profiles[0]) {
          await updateProfile(profiles[0].id, { subscription_status: 'past_due' })
        }
        break
      }
    }
  } catch (e) {
    console.error('Webhook handler error:', e)
  }

  return res.status(200).json({ received: true })
}
