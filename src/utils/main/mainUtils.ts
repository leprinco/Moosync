import https from 'https'
import http from 'http'
import fs from 'fs'

export function downloadFile(url: string, path: string) {
  return new Promise<void>((resolve, reject) => {
    const parsedURL = new URL(url)
    const method = parsedURL.protocol === 'https:' ? https.get : http.get

    const agents = [
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/37.0.2062.94 Chrome/37.0.2062.94 Safari/537.36',
      'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36',
      'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko',
      'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/600.8.9 (KHTML, like Gecko) Version/8.0.8 Safari/600.8.9'
    ]

    const request = method(
      {
        hostname: parsedURL.hostname,
        path: parsedURL.pathname,
        headers: { 'User-Agent': agents[Math.floor(Math.random() * agents.length)] }
      },
      function (response) {
        if (response.statusCode === 200) {
          const file = fs.createWriteStream(path)
          response.pipe(file)

          file.on('finish', () => {
            console.debug('Downloaded image from', url, 'at', path)
            file.close()
            resolve()
          })

          file.on('error', reject)
        } else {
          reject('Failed with status code: ' + response.statusCode)
        }
      }
    )

    request.on('error', reject)
  })
}
