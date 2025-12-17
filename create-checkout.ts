// =================================================================
// Supabase Edge Function: create-checkout
// =================================================================
// This function creates a Stripe Checkout session
// Deploy this to: supabase/functions/create-checkout/index.ts
//
// Setup Instructions:
// 1. Install Supabase CLI: npm install -g supabase
// 2. Initialize: supabase init
// 3. Create function: supabase functions new create-checkout
// 4. Copy this code to: supabase/functions/create-checkout/index.ts
// 5. Set secrets:
//    supabase secrets set STRIPE_SECRET_KEY=sk_test_your_key_here
// 6. Deploy: supabase functions deploy create-checkout
// =================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { animationId, animationTitle, price, cartItems } = await req.json()

    // Determine if this is a single item or cart checkout
    let lineItems = []
    
    if (cartItems && cartItems.length > 0) {
      // Multiple items from cart
      lineItems = cartItems.map((item: any) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.animationTitle,
            description: 'Premium Motion Capture Animation',
            images: ['https://your-site.github.io/mocap/og-image.jpg'], // Update with your image URL
          },
          unit_amount: Math.round(item.price * 100), // Convert to cents
        },
        quantity: 1,
      }))
    } else {
      // Single item purchase
      lineItems = [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: animationTitle,
            description: 'Premium Motion Capture Animation',
            images: ['https://your-site.github.io/mocap/og-image.jpg'], // Update with your image URL
          },
          unit_amount: Math.round(price * 100), // Convert to cents
        },
        quantity: 1,
      }]
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${req.headers.get('origin')}/thank-you.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/index.html`,
      metadata: {
        animationId: animationId || JSON.stringify(cartItems?.map((i: any) => i.animationId)),
        animationTitle: animationTitle || 'Multiple Items',
      },
    })

    return new Response(
      JSON.stringify({ sessionId: session.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error: any) {
    console.error('Error creating checkout session:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
