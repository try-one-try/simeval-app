# 恢复线上 Production 演示数据。在仓库根目录运行：.\scripts\reset-production-demo.ps1
# 想先检查目标、暂不改数据：.\scripts\reset-production-demo.ps1 --check
# 真正执行前会显示目标并要求输入 RESET_PRODUCTION；请在无人使用网站时运行。
# 会删除自行创建的任务和人工修改，再重建默认 Seed；不会删除表或修改 dev 分支。
# 这里不写数据库逻辑：把 production 和可选的 --check 交给共用启动器；它读取
# .env.production.local 并核对线上端点，再调用 prisma/reset-demo.ts 的事务恢复。

$scriptPath = Join-Path $PSScriptRoot 'reset-demo.mjs'
& node $scriptPath production @args
exit $LASTEXITCODE
