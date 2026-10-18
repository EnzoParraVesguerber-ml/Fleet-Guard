$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$env:PYTHONUTF8 = '1'

# [INTEGRACAO - AMBIENTE] Novo script para iniciar PostgreSQL, Flask e Angular locais.
# Usa as ferramentas em .local/ e .venv/; credenciais ficam no .env ignorado pelo Git.
# Nao gera nem recarrega dados. Inicia os servidores em segundo plano e salva logs em .local/.
$pgCtl = Join-Path $PSScriptRoot '.local/postgresql/pgsql/bin/pg_ctl.exe'
$python = Join-Path $PSScriptRoot '.venv/Scripts/python.exe'
$node = Join-Path $PSScriptRoot '.local/node.exe'
foreach ($arquivo in @($pgCtl, $python, $node, (Join-Path $PSScriptRoot '.env'))) {
    if (!(Test-Path -LiteralPath $arquivo)) { throw "Arquivo necessário ausente: $arquivo" }
}

& $pgCtl -D .local/pgdata status *> $null
if ($LASTEXITCODE -ne 0) {
    $processo = Start-Process -FilePath $pgCtl -ArgumentList '-D .local/pgdata -l .local/postgresql.log -w start' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru
    $processo.WaitForExit()
    if ($processo.ExitCode -ne 0) { throw 'Não foi possível iniciar PostgreSQL. Veja .local/postgresql.log.' }
}

if (!(Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue)) {
    $api = Start-Process -FilePath $python -ArgumentList '-m flask --app run run --host 127.0.0.1 --port 5000 --no-reload' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput .local/api.out.log -RedirectStandardError .local/api.err.log
    $api.Id | Set-Content .local/api.pid
}

if (!(Get-NetTCPConnection -LocalPort 4200 -State Listen -ErrorAction SilentlyContinue)) {
    $front = Start-Process -FilePath $node -ArgumentList 'node_modules/@angular/cli/bin/ng.js serve --host 127.0.0.1 --port 4200' -WorkingDirectory (Join-Path $PSScriptRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput .local/frontend.out.log -RedirectStandardError .local/frontend.err.log
    $front.Id | Set-Content .local/frontend.pid
}

Write-Output 'Inicialização solicitada. Aguarde a compilação e abra http://127.0.0.1:4200.'
Write-Output 'Logs: .local/api.err.log e .local/frontend.out.log. Banco: 127.0.0.1:5432/fleetguard_db.'
