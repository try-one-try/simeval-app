param(
  [ValidateSet('dev', 'test')]
  [string]$Database = 'test',
  [string]$AdminUser = 'root',
  [string]$AdminHost = '127.0.0.1',
  [int]$AdminPort = 3306
)

# 只在当前进程中把隐藏输入交给 Node 初始化程序；退出前清除临时环境变量。
$projectRoot = Split-Path -Parent $PSScriptRoot
$targetEnv = if ($Database -eq 'dev') { '.env.local' } else { '.env.test.local' }
if (Test-Path -LiteralPath (Join-Path $projectRoot $targetEnv)) {
  Write-Error "$targetEnv 已存在。为保护现有配置，初始化脚本不会覆盖它。"
  exit 1
}

$securePassword = Read-Host '输入 MySQL 管理员密码（输入时不显示）' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$result = 1
try {
  $env:SIMEVAL_DB_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $env:SIMEVAL_DB_ADMIN_USER = $AdminUser
  $env:SIMEVAL_DB_ADMIN_HOST = $AdminHost
  $env:SIMEVAL_DB_ADMIN_PORT = [string]$AdminPort
  Push-Location $projectRoot
  try {
    & node 'scripts/setup-local-db.mjs' $Database
    $result = $LASTEXITCODE
  } finally {
    Pop-Location
  }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  Remove-Item Env:SIMEVAL_DB_ADMIN_PASSWORD, Env:SIMEVAL_DB_ADMIN_USER, Env:SIMEVAL_DB_ADMIN_HOST, Env:SIMEVAL_DB_ADMIN_PORT -ErrorAction SilentlyContinue
}
exit $result
