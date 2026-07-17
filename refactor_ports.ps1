$srcDir = "d:\CursoJava\Programacion\Molinos\MolinosBack\Molinos\src"

# 1. Rename 'interfaces' to 'ports'
$interfacesDir = Join-Path $srcDir "interfaces"
$portsDir = Join-Path $srcDir "ports"

if (Test-Path $interfacesDir) {
    Rename-Item -Path $interfacesDir -NewName "ports" -Force
}

# 2. Iterate through all subdirectories in 'ports' (e.g. auth, material, nomina, pagos)
$modules = Get-ChildItem -Path $portsDir -Directory

foreach ($mod in $modules) {
    $servicePortDir = Join-Path $mod.FullName "service_port"
    $repoPortDir = Join-Path $mod.FullName "repository_port"
    
    # Create the subdirectories if they don't exist
    if (-not (Test-Path $servicePortDir)) { New-Item -ItemType Directory -Force -Path $servicePortDir | Out-Null }
    if (-not (Test-Path $repoPortDir)) { New-Item -ItemType Directory -Force -Path $repoPortDir | Out-Null }

    # Move files
    $files = Get-ChildItem -Path $mod.FullName -File
    foreach ($f in $files) {
        if ($f.Name -match "\.service\.interface\.ts$") {
            Move-Item -Path $f.FullName -Destination $servicePortDir -Force
        }
        elseif ($f.Name -match "\.repository\.interface\.ts$") {
            Move-Item -Path $f.FullName -Destination $repoPortDir -Force
        }
    }
}

# 3. Update all imports in .ts files
$allTsFiles = Get-ChildItem -Path $srcDir -Recurse -Filter "*.ts"
foreach ($f in $allTsFiles) {
    $content = Get-Content $f.FullName -Raw
    $originalContent = $content
    
    # Reemplazar service interfaces
    $content = [System.Text.RegularExpressions.Regex]::Replace($content, 
        "(['""])(.*?)/interfaces/([^/]+)/([a-zA-Z0-9_\-\.]+?\.service\.interface)(['""])", 
        "`$1`$2/ports/`$3/service_port/`$4`$5")
        
    # Reemplazar repository interfaces
    $content = [System.Text.RegularExpressions.Regex]::Replace($content, 
        "(['""])(.*?)/interfaces/([^/]+)/([a-zA-Z0-9_\-\.]+?\.repository\.interface)(['""])", 
        "`$1`$2/ports/`$3/repository_port/`$4`$5")
        
    if ($content -cne $originalContent) {
        Set-Content -Path $f.FullName -Value $content -NoNewline
        Write-Host "Updated imports in $($f.FullName)"
    }
}
Write-Host "Refactor completed."
