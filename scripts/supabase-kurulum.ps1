# Bildim! — Supabase kurulum betiği
# Önkoşul: `npx supabase login` ile giriş yapılmış olmalı.
param(
  [string]$ProjectRef = "zfpnxzybcpkxsotwdsey",
  [string]$AnthropicKey = $env:ANTHROPIC_API_KEY
)

$ErrorActionPreference = "Stop"

Write-Host "1/4 Proje baglaniyor..." -ForegroundColor Cyan
npx supabase link --project-ref $ProjectRef

Write-Host "2/4 Migration'lar uygulaniyor (sema + 40 soru + cron)..." -ForegroundColor Cyan
npx supabase db push

Write-Host "3/4 Edge Function deploy ediliyor..." -ForegroundColor Cyan
npx supabase functions deploy generate-questions

Write-Host "4/4 Secret'lar ayarlaniyor..." -ForegroundColor Cyan
$cronSecret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]]) -replace '[/+=]',''
if ($AnthropicKey) {
  npx supabase secrets set "ANTHROPIC_API_KEY=$AnthropicKey" "CRON_SECRET=$cronSecret"
} else {
  npx supabase secrets set "CRON_SECRET=$cronSecret"
  Write-Warning "ANTHROPIC_API_KEY verilmedi - soru uretimi icin sonradan ekleyin: npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-..."
}

Write-Host ""
Write-Host "CRON_SECRET: $cronSecret" -ForegroundColor Yellow
Write-Host "Soru uretimini test etmek icin:" -ForegroundColor Green
Write-Host "curl -X POST https://$ProjectRef.supabase.co/functions/v1/generate-questions -H `"x-cron-secret: $cronSecret`""
