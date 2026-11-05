# ============================================================
#  ThiThiPet POS - Script khoi chay ung dung
#  Duoc goi tu "ThiThiPet POS.bat" (khong chay truc tiep file nay)
# ============================================================

$root     = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend  = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

$Host.UI.RawUI.WindowTitle = 'ThiThiPet POS - Bang dieu khien'

function Write-Step($msg) { Write-Host "  $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "  [LOI] $msg" -ForegroundColor Red }

function Test-PortListening([int]$port) {
    $c = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    return ($null -ne $c)
}

function Wait-ForPort([int]$port, [int]$timeoutSec) {
    $t = 0
    while ($t -lt $timeoutSec) {
        if (Test-PortListening $port) { return $true }
        Start-Sleep -Seconds 1
        $t++
        if ($t % 5 -eq 0) { Write-Host "    ...dang cho cong $port ($t giay)" -ForegroundColor DarkGray }
    }
    return $false
}

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Magenta
Write-Host "        THITHIPET POS - DANG KHOI CHAY" -ForegroundColor Magenta
Write-Host "  ============================================" -ForegroundColor Magenta
Write-Host ""

# --- 1. Kiem tra Node.js -------------------------------------------------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Err "Chua cai Node.js. Tai tai https://nodejs.org roi chay lai file nay."
    Write-Host ""
    Read-Host "Nhan Enter de dong"
    exit 1
}
Write-Ok "Node.js $(node -v)"

# --- 2. Cai thu vien neu thieu ------------------------------------------
if (-not (Test-Path (Join-Path $backend 'node_modules'))) {
    Write-Step "Lan dau chay: dang cai thu vien cho backend (co the mat vai phut)..."
    Push-Location $backend; npm install; Pop-Location
}
if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
    Write-Step "Lan dau chay: dang cai thu vien cho giao dien (co the mat vai phut)..."
    Push-Location $frontend; npm install; Pop-Location
}

$procs = @()

# --- 3. Chay backend (cong 5000) ----------------------------------------
if (Test-PortListening 5000) {
    Write-Ok "Backend da chay san o cong 5000 (bo qua)"
} else {
    Write-Step "Dang bat may chu backend (cong 5000)..."
    $be = Start-Process -FilePath 'node' -ArgumentList 'server.js' `
            -WorkingDirectory $backend -WindowStyle Minimized -PassThru
    $procs += $be
    if (Wait-ForPort 5000 30) {
        Write-Ok "Backend da san sang"
    } else {
        Write-Err "Backend chua len duoc. Xem cua so 'node' o thanh tac vu (thuong do MySQL chua bat)."
    }
}

# --- 4. Chay giao dien (cong 3000) --------------------------------------
if (Test-PortListening 3000) {
    Write-Ok "Giao dien da chay san o cong 3000 (bo qua)"
} else {
    Write-Step "Dang bat giao dien (cong 3000), lan dau hoi lau..."
    $env:BROWSER = 'none'          # tu mo trinh duyet o buoc duoi
    $fe = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c npm start' `
            -WorkingDirectory $frontend -WindowStyle Minimized -PassThru
    $procs += $fe
    if (-not (Wait-ForPort 3000 180)) {
        Write-Err "Giao dien khoi dong qua lau. Kiem tra cua so 'npm start' o thanh tac vu."
    }
}

# --- 5. Mo trinh duyet ---------------------------------------------------
if (Test-PortListening 3000) {
    Write-Ok "Dang mo trinh duyet: http://localhost:3000"
    Start-Process 'http://localhost:3000'
}

Write-Host ""
Write-Host "  --------------------------------------------" -ForegroundColor Yellow
Write-Host "   App dang chay. Dia chi: http://localhost:3000" -ForegroundColor Yellow
Write-Host "   GIU CUA SO NAY MO trong luc dung app." -ForegroundColor Yellow
Write-Host "   Nhan Enter o day de TAT toan bo app." -ForegroundColor Yellow
Write-Host "  --------------------------------------------" -ForegroundColor Yellow
Write-Host ""
Read-Host " Nhan Enter de tat app"

# --- 6. Tat cac tien trinh da bat ---------------------------------------
Write-Host ""
Write-Step "Dang tat app..."
foreach ($p in $procs) {
    if ($p -and -not $p.HasExited) {
        taskkill /PID $p.Id /T /F 2>$null | Out-Null
    }
}
Write-Ok "Da tat xong."
Start-Sleep -Seconds 1
