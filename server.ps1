# ==========================================================
# PAPIH GAMING - SISTEM TURNAMEN LOKAL MANDIRI
# QRIS Dinamis DANA ZONA OUTDOOR + MacroDroid Auto-Redirect
# ==========================================================

Add-Type -AssemblyName System.Web

$port = 8080
$localIp = "192.168.0.48"
$dbFile = Join-Path $PSScriptRoot "database.json"
$appFile = Join-Path $PSScriptRoot "index.html"
$adminFile = Join-Path $PSScriptRoot "admin.html"

function Get-Database {
    if (-not (Test-Path $dbFile)) {
        return @{
            sessions = @()
            registrations = @()
            notifLogs = @()
        }
    }
    $raw = [System.IO.File]::ReadAllText($dbFile, [System.Text.Encoding]::UTF8)
    return ($raw | ConvertFrom-Json)
}

function Save-Database($dbObj) {
    $json = $dbObj | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText($dbFile, $json, [System.Text.Encoding]::UTF8)
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $port)
$listener.Start()

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       PAPIH GAMING - SISTEM TURNAMEN STANDALONE         " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  1. Form Pendaftaran : http://localhost:$port" -ForegroundColor Yellow
Write-Host "  2. Dashboard Admin  : http://localhost:$port/admin" -ForegroundColor Yellow
Write-Host "  3. Webhook HP       : http://$($localIp):$port/notif?text=[notif_text]" -ForegroundColor Magenta
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Menunggu koneksi dari HP MacroDroid & Browser..." -ForegroundColor Gray

while ($listener.Server.IsBound) {
    try {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
        $writer = New-Object System.IO.StreamWriter($stream, [System.Text.Encoding]::UTF8)

        $reqLine = $reader.ReadLine()
        if (-not $reqLine) { $client.Close(); continue }

        $parts = $reqLine.Split(" ")
        $method = $parts[0]
        $rawUrl = $parts[1]

        $headers = @{}
        $contentLength = 0
        while ($true) {
            $line = $reader.ReadLine()
            if ([string]::IsNullOrEmpty($line)) { break }
            $hParts = $line.Split(":", 2)
            if ($hParts.Length -eq 2) {
                $headers[$hParts[0].Trim().ToLower()] = $hParts[1].Trim()
            }
        }

        if ($headers.ContainsKey("content-length")) {
            [int]::TryParse($headers["content-length"], [ref]$contentLength) | Out-Null
        }

        $body = ""
        if ($contentLength -gt 0) {
            $buf = New-Object char[] $contentLength
            $reader.ReadBlock($buf, 0, $contentLength) | Out-Null
            $body = New-Object string ($buf)
        }

        $uriParts = $rawUrl.Split("?", 2)
        $path = $uriParts[0]
        $queryString = if ($uriParts.Length -gt 1) { $uriParts[1] } else { "" }

        # Helper Send Response
        $SendResponse = {
            param($status, $ctype, $data)
            $writer.WriteLine("HTTP/1.1 $status")
            $writer.WriteLine("Content-Type: $ctype; charset=utf-8")
            $writer.WriteLine("Access-Control-Allow-Origin: *")
            $writer.WriteLine("Access-Control-Allow-Headers: *")
            $writer.WriteLine("Access-Control-Allow-Methods: *")
            $writer.WriteLine("Connection: close")
            $writer.WriteLine("")
            $writer.Write($data)
            $writer.Flush()
        }

        # Handle CORS Preflight
        if ($method -eq "OPTIONS") {
            & $SendResponse "200 OK" "text/plain" "OK"
            $client.Close()
            continue
        }

        $db = Get-Database

        # 1. FRONTEND PENDAFTARAN (/)
        if ($path -eq "/" -or $path -eq "/index.html") {
            $html = [System.IO.File]::ReadAllText($appFile, [System.Text.Encoding]::UTF8)
            & $SendResponse "200 OK" "text/html" $html
        }
        # 2. ADMIN PANEL (/admin)
        elseif ($path -eq "/admin" -or $path -eq "/admin.html") {
            $html = [System.IO.File]::ReadAllText($adminFile, [System.Text.Encoding]::UTF8)
            & $SendResponse "200 OK" "text/html" $html
        }
        # 3. API DAFTAR SESI
        elseif ($path -eq "/api/sessions") {
            $resp = @{ sessions = $db.sessions } | ConvertTo-Json
            & $SendResponse "200 OK" "application/json" $resp
        }
        # 4. API DAFTAR TIM BARU
        elseif ($path -eq "/api/register" -and $method -eq "POST") {
            $data = $body | ConvertFrom-Json
            $selectedSession = $db.sessions | Where-Object { $_.id -eq $data.sessionId } | Select-Object -First 1
            if (-not $selectedSession) { $selectedSession = $db.sessions[0] }

            $baseFee = if ($data.baseFee) { [int]$data.baseFee } else { [int]$selectedSession.fee }

            $pendingCodes = @($db.registrations | Where-Object { $_.status -eq "PENDING" } | ForEach-Object { $_.kodeUnik })
            $kode = Get-Random -Minimum 11 -Maximum 99
            for ($attempt = 0; $attempt -lt 100; $attempt++) {
                if ($pendingCodes -notcontains $kode) { break }
                $kode = Get-Random -Minimum 11 -Maximum 99
            }

            $totalNominal = $baseFee + $kode
            $regId = "REG-" + (Get-Date -Format "yyMMddHHmmss") + "-" + (Get-Random -Minimum 100 -Maximum 999)

            $newReg = @{
                regId = $regId
                teamName = $data.teamName
                captainNick = $data.captainNick
                captainWa = $data.captainWa
                logo = $data.logo
                sessionId = $selectedSession.id
                sessionJam = $selectedSession.jam
                sessionLabel = $selectedSession.label
                baseFee = $baseFee
                kodeUnik = $kode
                totalNominal = $totalNominal
                status = "PENDING"
                time = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
            }

            if (-not $db.registrations) { $db.registrations = @() }
            $db.registrations += $newReg
            Save-Database $db

            Write-Host "`n[PENDAFTARAN BARU] Tim '$($data.teamName)' - Sesi $($selectedSession.jam) - Total: Rp $totalNominal (Kode: +$kode)" -ForegroundColor Yellow

            $resp = @{
                success = $true
                regId = $regId
                teamName = $data.teamName
                baseFee = $baseFee
                kodeUnik = $kode
                totalNominal = $totalNominal
                sessionJam = $selectedSession.jam
                sessionLabel = $selectedSession.label
            } | ConvertTo-Json
            & $SendResponse "200 OK" "application/json" $resp
        }
        # 5. API CEK STATUS TIM
        elseif ($path -eq "/api/check-status") {
            $qParams = [System.Web.HttpUtility]::ParseQueryString($queryString)
            $regId = $qParams["regId"]
            $reg = $db.registrations | Where-Object { $_.regId -eq $regId } | Select-Object -First 1

            if ($reg -and $reg.status -eq "LUNAS") {
                $session = $db.sessions | Where-Object { $_.id -eq $reg.sessionId } | Select-Object -First 1
                $waGroup = if ($session -and $session.waGroup) { $session.waGroup } else { "https://chat.whatsapp.com/test-ff-papih" }

                $resp = @{
                    status = "LUNAS"
                    teamName = $reg.teamName
                    sessionJam = $reg.sessionJam
                    sessionLabel = $reg.sessionLabel
                    waGroup = $waGroup
                } | ConvertTo-Json
                & $SendResponse "200 OK" "application/json" $resp
            } else {
                $resp = '{"status":"PENDING"}'
                & $SendResponse "200 OK" "application/json" $resp
            }
        }
        # 6. WEBHOOK DARI MACRODROID HP (/notif)
        elseif ($path -eq "/notif") {
            $incomingText = ""
            if ($queryString) {
                $qParams = [System.Web.HttpUtility]::ParseQueryString($queryString)
                if ($qParams["text"]) { $incomingText = $qParams["text"] }
            }
            if (-not $incomingText -and $body) {
                $bParams = [System.Web.HttpUtility]::ParseQueryString($body)
                if ($bParams["text"]) { $incomingText = $bParams["text"] } else { $incomingText = $body }
            }

            Write-Host "`n[NOTIF HP DITERIMA] $incomingText" -ForegroundColor Green

            if (-not $db.notifLogs) { $db.notifLogs = @() }
            $db.notifLogs += @{
                time = (Get-Date -Format "HH:mm:ss")
                text = $incomingText
            }

            $cleanStr = $incomingText -replace '\.', ''
            $matches = [regex]::Matches($cleanStr, '\b\d{4,6}\b')
            $matchedTeam = $null

            foreach ($m in $matches) {
                $foundNominal = [int]$m.Value
                $pendingTeam = $db.registrations | Where-Object { $_.status -eq "PENDING" -and $_.totalNominal -eq $foundNominal } | Select-Object -First 1
                if ($pendingTeam) {
                    $pendingTeam.status = "LUNAS"
                    $pendingTeam.paidAt = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
                    $matchedTeam = $pendingTeam
                    Write-Host "  -> VERIFIKASI SUKSES: Tim '$($pendingTeam.teamName)' LUNAS! (Sesi $($pendingTeam.sessionJam))" -ForegroundColor Cyan
                    break
                }
            }

            Save-Database $db
            $resp = @{ status = "success"; matched = ($matchedTeam -ne $null) } | ConvertTo-Json
            & $SendResponse "200 OK" "application/json" $resp
        }
        # 7. ADMIN API DATA (/api/admin/data)
        elseif ($path -eq "/api/admin/data") {
            $resp = $db | ConvertTo-Json -Depth 5
            & $SendResponse "200 OK" "application/json" $resp
        }
        # 8. ADMIN SIMPAN PENGATURAN SESI (/api/admin/save-sessions)
        elseif ($path -eq "/api/admin/save-sessions" -and $method -eq "POST") {
            $data = $body | ConvertFrom-Json
            $db.sessions = $data.sessions
            Save-Database $db
            Write-Host "[ADMIN] Pengaturan sesi dan link grup WhatsApp diperbarui!" -ForegroundColor Green
            $resp = '{"success":true,"message":"Sesi berhasil disimpan"}'
            & $SendResponse "200 OK" "application/json" $resp
        }
        # 9. ADMIN APPROVE MANUAL (/api/admin/manual-approve)
        elseif ($path -eq "/api/admin/manual-approve" -and $method -eq "POST") {
            $data = $body | ConvertFrom-Json
            $reg = $db.registrations | Where-Object { $_.regId -eq $data.regId } | Select-Object -First 1
            if ($reg) {
                $reg.status = "LUNAS"
                $reg.paidAt = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
                Save-Database $db
            }
            $resp = '{"success":true}'
            & $SendResponse "200 OK" "application/json" $resp
        }
        # 10. ADMIN HAPUS REGISTRASI (/api/admin/delete-reg)
        elseif ($path -eq "/api/admin/delete-reg" -and $method -eq "POST") {
            $data = $body | ConvertFrom-Json
            $db.registrations = @($db.registrations | Where-Object { $_.regId -ne $data.regId })
            Save-Database $db
            $resp = '{"success":true}'
            & $SendResponse "200 OK" "application/json" $resp
        }
        else {
            & $SendResponse "404 Not Found" "text/plain" "Not Found"
        }

        $client.Close()
    }
    catch {
        # Ignore disconnects
    }
}
