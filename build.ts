/**
 * Remove old files, copy front-end ones.
 */

import fs from 'fs-extra'
import Logger from 'jet-logger'

try {
  // Remove current build
  fs.removeSync('./dist/')
  // Copy front-end files
  fs.copySync('./src/public', './dist/public')
  fs.copySync('./src/bundles', './dist/bundles')
  fs.copySync('./src/views', './dist/views')
} catch (err) {
  Logger.err(err)
}
