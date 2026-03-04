/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs')
const path = require('path')
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses')

function resolveElectronBinaryPath(context) {
  const executableName = context.packager.appInfo.productFilename

  if (context.electronPlatformName === 'darwin') {
    return path.join(context.appOutDir, `${executableName}.app`, 'Contents', 'MacOS', executableName)
  }

  if (context.electronPlatformName === 'win32') {
    return path.join(context.appOutDir, `${executableName}.exe`)
  }

  return path.join(context.appOutDir, executableName)
}

async function afterPack(context) {
  const electronBinaryPath = resolveElectronBinaryPath(context)

  if (!fs.existsSync(electronBinaryPath)) {
    throw new Error(`Cannot flip Electron fuses. Binary not found: ${electronBinaryPath}`)
  }

  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  })

  console.log(`Electron fuses hardened for ${context.electronPlatformName}: ${electronBinaryPath}`)
}

module.exports = afterPack
module.exports.default = afterPack
