// Vercel Serverless Function for Stripe Webhook
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Disable body parsing - Stripe needs raw body
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to get raw body
const getRawBody = async (req) => {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      resolve(Buffer.from(data));
    });
  });
};

export default async function handler(req, res) {
  console.log('🎯 Webhook received!');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log('✅ Signature verified!');
  } catch (err) {
    console.error('❌ Signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  console.log('📦 Event type:', event.type);

  // Handle checkout.session.completed
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const userId = session.client_reference_id;
    const isCart = session.metadata?.is_cart === 'true';
    const amountPaid = (session.amount_total || 0) / 100;

    console.log('💳 Processing purchase:', {
      sessionId: session.id,
      userId,
      isCart,
      amount: amountPaid,
    });

    if (!userId) {
      console.error('❌ Missing userId');
      return res.status(400).json({ error: 'Missing user ID' });
    }

    try {
      if (isCart) {
        // Multiple items
        const animationIds = session.metadata?.animation_ids?.split(',') || [];

        if (animationIds.length === 0) {
          console.error('❌ No animation IDs');
          return res.status(400).json({ error: 'Missing animation IDs' });
        }

        const pricePerItem = amountPaid / animationIds.length;

        const purchases = animationIds.map((animationId) => ({
          user_id: userId,
          animation_id: animationId,
          stripe_session_id: session.id,
          amount_paid: pricePerItem,
        }));

        console.log('💾 Inserting cart:', purchases.length, 'items');

        const { error } = await supabase.from('purchases').insert(purchases);

        if (error) {
          console.error('❌ Database error:', error);
          return res.status(500).json({ error: error.message });
        }

        console.log('✅ Cart purchases recorded!');
      } else {
        // Single item
        const animationId = session.metadata?.animation_id;

        if (!animationId) {
          console.error('❌ Missing animationId');
          return res.status(400).json({ error: 'Missing animation ID' });
        }

        console.log('💾 Inserting single purchase');

        const { error } = await supabase.from('purchases').insert([
          {
            user_id: userId,
            animation_id: animationId,
            stripe_session_id: session.id,
            amount_paid: amountPaid,
          },
        ]);

        if (error) {
          console.error('❌ Database error:', error);
          return res.status(500).json({ error: error.message });
        }

        console.log('✅ Purchase recorded!');
      }
    } catch (err) {
      console.error('💥 Error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(200).json({ received: true });
}
