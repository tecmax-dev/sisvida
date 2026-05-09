export REAL_KEY=$SUPABASE_SERVICE_ROLE_KEY
sed -i "s|PLACEHOLDER_KEY|$REAL_KEY|g" test_e2e_boleto_flow.ts
deno run --allow-net test_e2e_boleto_flow.ts
