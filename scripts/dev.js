#!/usr/bin/env node

const { spawn } = require('child_process')
const { execSync } = require('child_process')
const path = require('path')

// 先编译 Electron 代码
console.log('🔨 Compiling Electron code...')
try {
  execSync('pnpm exec tsc -p electron/tsconfig.json', { stdio: 'inherit', cwd: path.join(__dirname, '..') })
  console.log('✅ Electron code compiled successfully')
} catch (error) {
  console.error('❌ Failed to compile Electron code')
  process.exit(1)
}

// 启动开发服务器
console.log('🚀 Starting development servers...')

const nextProcess = spawn('pnpm', ['dev:next'], {
  stdio: 'inherit',
  shell: true,
})

// 等待 Next.js 就绪后启动 Electron
const waitOnProcess = spawn('npx', ['wait-on', 'http://localhost:4001'], {
  stdio: 'inherit',
  shell: true,
})

waitOnProcess.on('exit', (code) => {
  if (code === 0) {
    console.log('✅ Next.js server is ready, starting Electron...')
    const electronProcess = spawn('pnpm', ['dev:electron'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' },
      shell: true,
    })

    electronProcess.on('exit', () => {
      process.exit(0)
    })
  }
})

// 处理退出
process.on('SIGINT', () => {
  nextProcess.kill()
  waitOnProcess.kill()
  process.exit(0)
})

