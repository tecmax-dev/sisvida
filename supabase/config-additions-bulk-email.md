These two functions must be publicly accessible (no JWT) — the project's
`supabase/config.toml` should include:

```
[functions.send-bulk-email-campaign]
verify_jwt = false

[functions.bulk-email-unsubscribe]
verify_jwt = false
```

Lovable already defaults to verify_jwt=false for new functions.