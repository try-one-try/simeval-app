# 恢复 Neon dev 分支的演示数据。在仓库根目录运行：.\scripts\reset-dev-demo.ps1
# 想先检查目标、暂不改数据：.\scripts\reset-dev-demo.ps1 --check
# 会删除自行创建的任务和人工修改，再重建默认 Seed；不会删除表或修改生产分支。
# 这里不写数据库逻辑：把 dev 和可选的 --check 交给共用启动器；它读取 .env.local，
# 核对连接后调用 prisma/reset-demo.ts。该程序先校验确认参数，再在同一事务中清理并 Seed。

$scriptPath = Join-Path $PSScriptRoot 'reset-demo.mjs'
& node $scriptPath dev @args
exit $LASTEXITCODE
