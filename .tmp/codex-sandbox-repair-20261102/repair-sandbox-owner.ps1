[CmdletBinding()]
param([ValidateSet('Backup', 'Repair', 'Rollback')][string]$Mode = 'Backup')
$ErrorActionPreference = 'Stop'
$target = 'C:\Users\Administrator\.codex\.sandbox-bin'
$expectedUserSid = 'S-1-5-21-2472275971-2834174559-270362074-500'
$originalOwnerSid = 'S-1-5-32-544'
$backupPath = Join-Path $PSScriptRoot 'permissions-before.json'
$resultPath = Join-Path $PSScriptRoot ($Mode.ToLowerInvariant() + '-result.json')
$accessSection = [System.Security.AccessControl.AccessControlSections]::Access
function Read-State {
    $item = Get-Item -LiteralPath $target -Force
    if ($item.FullName -ne $target -or -not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Target must be the exact existing directory and must not be a reparse point.'
    }
    $acl = Get-Acl -LiteralPath $target
    $owner = $acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value
    $ownerRights = @($acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]) | Where-Object { $_.IdentityReference.Value -eq 'S-1-3-4' })
    if ($ownerRights.Count -gt 0) { throw 'OWNER RIGHTS ACE requires a separate review.' }
    [pscustomobject]@{
        target = $target
        ownerSid = $owner
        sddl = $acl.Sddl
        accessSddl = $acl.GetSecurityDescriptorSddlForm($accessSection)
        accessProtected = $acl.AreAccessRulesProtected
        capturedAt = (Get-Date).ToString('o')
    }
}
try {
    $before = Read-State
    if ($Mode -eq 'Backup') {
        if (Test-Path -LiteralPath $backupPath) { throw 'Backup already exists; do not overwrite the original snapshot.' }
        if ($before.ownerSid -ne $originalOwnerSid) { throw 'Unexpected original owner.' }
        $before | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $backupPath -Encoding UTF8
        $before | ConvertTo-Json -Depth 5
        exit 0
    }
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'A Windows UAC elevated administrator token is required.' }
    $saved = Get-Content -LiteralPath $backupPath -Raw | ConvertFrom-Json
    if ($saved.target -ne $target -or $saved.ownerSid -ne $originalOwnerSid) { throw 'Backup identity mismatch.' }
    if ($before.accessSddl -ne $saved.accessSddl -or $before.accessProtected -ne $saved.accessProtected) { throw 'Directory DACL has changed since backup; stop for review.' }
    $desiredOwner = $expectedUserSid
    $expectedOwner = $originalOwnerSid
    if ($Mode -eq 'Rollback') { $desiredOwner = $originalOwnerSid; $expectedOwner = $expectedUserSid }
    if ($before.ownerSid -ne $expectedOwner) { throw 'Unexpected current owner; no changes applied.' }
    # Exact directory only. Never recurse or change the DACL here.
    if ($Mode -eq 'Repair' -and $identity.User.Value -ne $expectedUserSid) {
        throw 'The elevated account must match the intended owner before takeown is used.'
    }
    $savedErrorPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        if ($Mode -eq 'Repair') {
            $ownerOutput = & "$env:SystemRoot\System32\takeown.exe" /F $target 2>&1
        } else {
            $ownerOutput = & "$env:SystemRoot\System32\icacls.exe" $target /setowner ('*' + $desiredOwner) 2>&1
        }
        $ownerExit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $savedErrorPreference
    }
    $ownerOutput | Set-Content -LiteralPath (Join-Path $PSScriptRoot ($Mode.ToLowerInvariant() + '-owner-command.txt')) -Encoding UTF8
    if ($ownerExit -ne 0) { throw "Owner command failed with exit code $ownerExit." }
    $after = Read-State
    $daclUnchanged = $after.accessSddl -eq $before.accessSddl -and $after.accessProtected -eq $before.accessProtected
    if ($after.ownerSid -ne $desiredOwner -or -not $daclUnchanged) { throw 'Post-change owner or DACL verification failed; inspect state before further changes.' }
    [pscustomobject]@{ success = $true; mode = $Mode; daclUnchanged = $daclUnchanged; before = $before; after = $after } |
        ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $resultPath -Encoding UTF8
    exit 0
} catch {
    [pscustomobject]@{ success = $false; mode = $Mode; error = $_.Exception.Message; at = (Get-Date).ToString('o') } |
        ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $resultPath -Encoding UTF8
    exit 1
}

