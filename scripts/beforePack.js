const { readdir, rm } = require('fs/promises')
const path = require('path')

async function afterPack(context) {
  if (process.platform === 'win32') {
    const data = await readdir(
      path.join(context.appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', 'bufferutil', 'prebuilds')
    )

    for (const d of data) {
      if (!d.startsWith('win')) {
        await rm(
          path.join(context.appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', 'bufferutil', 'prebuilds', d),
          { recursive: true, force: true }
        )
      }
    }
  }
}

module.exports.default = afterPack
