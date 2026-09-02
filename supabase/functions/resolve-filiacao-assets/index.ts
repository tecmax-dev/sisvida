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
    if (signature_url) {
      let resolvedSigUrl = signature_url

      // If it's a storage path, try known buckets until one resolves
      let dataUrl: string | null = null
      if (!signature_url.startsWith('http') && !signature_url.startsWith('data:')) {
        const buckets = ['patient-signatures', 'signatures', 'sindical-documentos', 'patient-documents']
        let cleanPath = signature_url.replace(/^\/+/, '')
        for (const bucket of buckets) {
          const path = cleanPath.startsWith(`${bucket}/`) ? cleanPath.slice(bucket.length + 1) : cleanPath
          const { data: signed } = await supabaseClient.storage.from(bucket).createSignedUrl(path, 60)
          if (!signed?.signedUrl) continue
          const attempt = await fetchImageAsBase64(signed.signedUrl)
          if (attempt) {
            resolvedSigUrl = signed.signedUrl
            dataUrl = attempt
            break
          }
        }
      }

      if (!dataUrl) dataUrl = await fetchImageAsBase64(resolvedSigUrl)
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
