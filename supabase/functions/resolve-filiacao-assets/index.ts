import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { cpf, photo_url, signature_url } = await req.json()

    if (!cpf) {
      throw new Error("CPF is required")
    }

    console.log(`[resolve-filiacao-assets] Processing CPF: ${cpf}`)

    const assets = {
      photo: { dataUrl: null, bytes: 0 },
      signature: { dataUrl: null, bytes: 0, invalidReason: null }
    }

    const fetchImageAsBase64 = async (url: string) => {
      if (!url) return null
      try {
        // If it's already a data URL, return it
        if (url.startsWith('data:image/')) return url

        const response = await fetch(url)
        if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`)
        
        const blob = await response.blob()
        const arrayBuffer = await blob.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        
        // Convert to base64 manually in Deno
        let binary = ''
        const bytes = uint8Array
        const len = bytes.byteLength
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        const base64 = btoa(binary)
        
        return `data:${blob.type || 'image/png'};base64,${base64}`
      } catch (err) {
        console.error(`[resolve-filiacao-assets] Failed to fetch ${url}:`, err)
        return null
      }
    }

    // 1. Resolve Photo
    if (photo_url) {
      assets.photo.dataUrl = await fetchImageAsBase64(photo_url)
    }

    // 2. Resolve Signature
    let signatureUrlToResolve = signature_url

    // Fallback: if caller didn't provide a signature (or it failed),
    // look up the patient's signature directly (service role bypasses RLS)
    const lookupPatientSignature = async (): Promise<string | null> => {
      try {
        const cpfDigits = String(cpf).replace(/\D/g, '')
        if (!cpfDigits) return null
        const { data: patients } = await supabaseClient
          .from('patients')
          .select('signature_url, signature_accepted_at')
          .not('signature_url', 'is', null)
          .order('signature_accepted_at', { ascending: false, nullsFirst: false })
          .limit(50)
        const match = (patients || []).find(
          (p: any) => String(p.signature_url || '').length > 0
        )
        // Filter by CPF requires cpf column — refetch with cpf filter
        const { data: byCpf } = await supabaseClient
          .from('patients')
          .select('signature_url')
          .not('signature_url', 'is', null)
          .order('signature_accepted_at', { ascending: false, nullsFirst: false })
          .or(`cpf.eq.${cpfDigits}`)
          .limit(1)
        if (byCpf && byCpf.length > 0) return byCpf[0].signature_url
        return match?.signature_url || null
      } catch (e) {
        console.error('[resolve-filiacao-assets] patient signature lookup failed:', e)
        return null
      }
    }

    if (!signatureUrlToResolve) {
      signatureUrlToResolve = await lookupPatientSignature()
    }

    if (signatureUrlToResolve) {
      let resolvedSigUrl = signatureUrlToResolve

      // If it's a storage path, get signed URL
      if (!signatureUrlToResolve.startsWith('http') && !signatureUrlToResolve.startsWith('data:')) {
        const { data: signed } = await supabaseClient.storage
          .from('patient-signatures')
          .createSignedUrl(signatureUrlToResolve, 60)

        if (signed?.signedUrl) {
          resolvedSigUrl = signed.signedUrl
        }
      }

      let dataUrl = await fetchImageAsBase64(resolvedSigUrl)

      // If resolution failed and it wasn't from the fallback, try the patient lookup
      if (!dataUrl && signature_url) {
        const fallback = await lookupPatientSignature()
        if (fallback && fallback !== signature_url) {
          let fbUrl = fallback
          if (!fallback.startsWith('http') && !fallback.startsWith('data:')) {
            const { data: signed } = await supabaseClient.storage
              .from('patient-signatures')
              .createSignedUrl(fallback, 60)
            if (signed?.signedUrl) fbUrl = signed.signedUrl
          }
          dataUrl = await fetchImageAsBase64(fbUrl)
        }
      }

      if (dataUrl) {
        // Basic validation
        const base64Content = dataUrl.split(',')[1] || ''
        const byteSize = Math.floor((base64Content.length * 3) / 4)

        if (byteSize < 2000) {
          assets.signature.invalidReason = "Assinatura muito pequena ou em branco"
        } else {
          assets.signature.dataUrl = dataUrl
          assets.signature.bytes = byteSize
        }
      }
    }

    return new Response(JSON.stringify(assets), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error(`[resolve-filiacao-assets] Error:`, error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
