// =================================================================
// Supabase Edge Function: get-download
// =================================================================
// This function verifies payment and generates secure download links
// Deploy this to: supabase/functions/get-download/index.ts
//
// Setup Instructions:
// 1. Create function: supabase functions new get-download
// 2. Copy this code to: supabase/functions/get-download/index.ts
// 3. Set secrets:
//    supabase secrets set STRIPE_SECRET_KEY=sk_test_your_key_here
//    supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
// 4. Deploy: supabase functions deploy get-download
// =================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

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
    const { sessionId } = await req.json()

    if (!sessionId) {
      throw new Error('Session ID is required')
    }

    // Retrieve the Stripe session to verify payment
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      throw new Error('Payment not completed')
    }

    // Initialize Supabase Admin Client (with service role key)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get animation details from metadata
    const animationId = session.metadata?.animationId
    const animationTitle = session.metadata?.animationTitle

    // =================================================================
    // GENERATE SIGNED DOWNLOAD URL FROM SUPABASE STORAGE
    // =================================================================
    // IMPORTANT: Upload your mocap files to Supabase Storage first!
    // Storage bucket should be PRIVATE for security
    //
    // File structure example:
    // animations/
    //   ├── combat-sword-master-pack.zip
    //   ├── natural-walk-cycles.zip
    //   └── ...
    // =================================================================

    // Generate a signed URL that expires in 24 hours
    const { data: urlData, error: urlError } = await supabaseAdmin
      .storage
      .from('animations') // Your private bucket name
      .createSignedUrl(`${animationId}.zip`, 86400) // 24 hours = 86400 seconds

    if (urlError) {
      console.error('Error generating signed URL:', urlError)
      throw new Error('Failed to generate download link')
    }

    // =================================================================
    // OPTIONAL: LOG PURCHASE TO DATABASE
    // =================================================================
    // You can create a 'purchases' table to track all downloads
    /*
    await supabaseAdmin
      .from('purchases')
      .insert({
        stripe_session_id: sessionId,
        animation_id: animationId,
        amount: session.amount_total / 100,
        customer_email: session.customer_details?.email,
        created_at: new Date().toISOString()
      })
    */

    // Return the signed URL and order details
    return new Response(
      JSON.stringify({
        downloadUrl: urlData.signedUrl,
        orderDetails: {
          orderId: sessionId.substring(0, 16),
          animationTitle: animationTitle,
          amount: (session.amount_total / 100).toFixed(2),
          date: new Date().toLocaleDateString(),
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error: any) {
    console.error('Error processing download:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
