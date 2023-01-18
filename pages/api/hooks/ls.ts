import type { NextApiResponse, NextApiRequest } from 'next'
import { buffer } from 'micro'
import crypto from 'crypto'

// you might need to extend this if you need additional properties from the request body
// details: https://docs.lemonsqueezy.com/api/webhooks
export interface ResBody extends NextApiRequest {
  body: {
    meta: {
      event_name: 'order_created' | 'order_refunded'
      custom_data: {
        // this is where any custom checkout parameters will be accessible
        // details: https://docs.lemonsqueezy.com/api/checkouts#create-a-checkout
        userId: string
      }
    }
    data: {
      id: string
      attributes: {
        identifier: string
      }
    }
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: ResBody, res: NextApiResponse) {
  // you need to set this webhook secret inside your Lemon Squeezy account
  // Settings -> Webhooks -> create or click on a webhook URL, set the secret
  const signingSecret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || ''

  if (req.method !== 'POST') {
    // you can see whether a webhook delivers successfully in your Lemon Squeezy account
    // -> Settings -> Webhooks -> Recent deliveries
    return res.status(405).json({
      message: 'Method not allowed',
    })
  }

  try {
    // check that the request really came from Lemon Squeezy and is about this order
    const rawBody = (await buffer(req)).toString('utf-8')
    const hmac = crypto.createHmac('sha256', signingSecret)
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8')
    const signature = Buffer.from(req.headers['x-signature'] as string, 'utf8')

    if (!crypto.timingSafeEqual(digest, signature)) {
      return res.status(400).json({
        message: 'Invalid signature.',
      })
    }

    const payload: ResBody['body'] = JSON.parse(rawBody)

    const {
      meta: {
        event_name: eventName,
        // userId is a custom checkout variable I am using
        custom_data: { userId },
      },
      data: {
        id: orderId,
        attributes: { identifier },
      },
    } = payload

    if (eventName === 'order_created') {
      // do something when a new purchase comes in
    } else if (eventName === 'order_refunded') {
      // do something when the purchase is refunded
    } else if (eventName === '') {
      // do somthing with any of the following events:
      // - subscription_created
      // - subscription_cancelled
      // - subscription_resumed
      // - subscription_expired
      // - subscription_paused
      // - subscription_unpaused
      // - subscription_payment_failed
      // - subscription_payment_success
      // - subscription_payment_recovered
      // - license_key_created
    } else {
      return res.status(400).json({
        message: `Unknown event name: ${eventName} for order: ${identifier} (${orderId})`,
      })
    }
  } catch (e: unknown) {
    if (typeof e === 'string') {
      return res.status(400).json({
        message: `Webhook error: ${e}`,
      })
    }
    if (e instanceof Error) {
      return res.status(400).json({
        message: `Webhook error: ${e.message}`,
      })
    }
    throw e
  }

  // if no errors occur, respond with a 200 success
  res.send({ received: true })
}
