/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
let app, dialog
try {
  const electron = require('electron')
  app = electron.app
  dialog = electron.dialog
} catch {
  // Running under plain Node (e.g. electron-vite dev wrapper)
}

const builtEntry = path.join(__dirname, 'out', 'main', 'index.js')

const messages = {
  ko: {
    title: '우산 실행 오류',
    handoffFailed: [
      '앱 실행을 이어서 시작하지 못했습니다.',
      '',
      '이 폴더에서 아래 명령으로 다시 실행해 주세요.',
      '- npm run dev',
      '- npm run start',
      '',
      `실행 파일: ${builtEntry}`,
    ],
    buildMissing: [
      '앱을 시작하는 데 필요한 파일이 없습니다.',
      '',
      '이 폴더에서 아래 명령으로 다시 실행해 주세요.',
      '- npm run dev',
      '- npm run start',
      '',
      '설치한 앱인데도 이 창이 뜨면 다시 설치해 주세요.',
      '',
      `없는 파일: ${builtEntry}`,
    ],
  },
  en: {
    title: 'Usan launch error',
    handoffFailed: [
      'Usan could not continue launching.',
      '',
      'Start it again from this folder with one of these commands.',
      '- npm run dev',
      '- npm run start',
      '',
      `Entry file: ${builtEntry}`,
    ],
    buildMissing: [
      'Files needed to start Usan are missing.',
      '',
      'Start it again from this folder with one of these commands.',
      '- npm run dev',
      '- npm run start',
      '',
      'If this is an installed app, reinstall it.',
      '',
      `Missing file: ${builtEntry}`,
    ],
  },
  ja: {
    title: 'ウサン起動エラー',
    handoffFailed: [
      'アプリを続けて起動できませんでした。',
      '',
      'このフォルダで次のどちらかを実行してください。',
      '- npm run dev',
      '- npm run start',
      '',
      `実行ファイル: ${builtEntry}`,
    ],
    buildMissing: [
      '起動に必要なファイルがありません。',
      '',
      'このフォルダで次のどちらかを実行してください。',
      '- npm run dev',
      '- npm run start',
      '',
      'インストール済みアプリなら再インストールしてください。',
      '',
      `不足ファイル: ${builtEntry}`,
    ],
  },
}

function resolveLocale() {
  const locale = (app.getLocale() || '').toLowerCase()
  if (locale.startsWith('ja')) return 'ja'
  if (locale.startsWith('en')) return 'en'
  return 'ko'
}

function showBootstrapError(kind) {
  const locale = resolveLocale()
  const copy = messages[locale]
  dialog.showErrorBox(copy.title, copy[kind].join('\n'))
  app.exit(1)
}

if (fs.existsSync(builtEntry)) {
  if (process.env.USAN_BOOTSTRAP_CHILD === '1') {
    app.whenReady().then(() => {
      showBootstrapError('handoffFailed')
    })
  } else {
    const child = spawn(process.execPath, [builtEntry, ...process.argv.slice(2)], {
      detached: true,
      env: {
        ...process.env,
        USAN_BOOTSTRAP_CHILD: '1',
      },
      stdio: 'ignore',
    })
    child.unref()
    if (app) app.exit(0)
    else process.exit(0)
  }
} else {
  app.whenReady().then(() => {
    showBootstrapError('buildMissing')
  })
}
