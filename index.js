const { spawn, exec } = require('child_process')
const { promisify } = require('util')

const {
  ERROR_SERVICE_REQUIRED,
  ERROR_SERVICE_MUST_BE_STRING,
  ERROR_MATCHERS_MUST_NOT_BE_EMPTY,
} = require('./constants')

const execPromise = promisify(exec)

const { onlyOnce, stop } = require('./helpers')

const wfb = (service, matchersMixed) =>
  new Promise((resolve, reject) => {
    let matchers = Array.isArray(matchersMixed)
      ? matchersMixed
      : [matchersMixed]
    matchers = matchers.filter(matcher => !!matcher)
    if (typeof service !== 'string') {
      reject(new Error(ERROR_SERVICE_MUST_BE_STRING))
      return
    }
    if (matchers.length === 0) {
      reject(new Error(ERROR_MATCHERS_MUST_NOT_BE_EMPTY))
      return
    }
    const docker = spawn('docker-compose', ['up', service])
    let errorMessage
    docker.stderr.on('data', data => {
      errorMessage = data.toString()
    })
    docker.on('exit', (code, signal) => {
      if (code) {
        reject(new Error(errorMessage))
      } else if (signal) {
        reject(new Error(errorMessage))
      }
    })
    const once = onlyOnce()
    docker.stdout.on('data', data => {
      const line = data.toString()
      matchers.some((match, i) => {
        if (
          (match instanceof RegExp && match.test(line)) ||
          (typeof match === 'string' && line.includes(match))
        ) {
          matchers.splice(i, 1)
          return true
        }
        return false
      })
      if (matchers.length === 0) {
        once(resolve, stop.bind(null, service, docker))
      }
    })
    docker.on('error', once.bind(null, reject))
  })

module.exports = (service, matchers) => {
  if (service && matchers) {
    return wfb(service, matchers)
  }
  if (service) {
    return execPromise(`docker-compose run ${service}`)
  }
  return Promise.reject(new Error(ERROR_SERVICE_REQUIRED))
}
