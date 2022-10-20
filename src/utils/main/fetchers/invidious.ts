import https from 'https'
import { CacheHandler } from './cacheFile'
import path from 'path'
import { app } from 'electron'
import { loadSelectivePreference } from '../db/preferences'

export class InvidiousRequester extends CacheHandler {
  constructor() {
    super(path.join(app.getPath('sessionData'), app.getName(), 'invidious.cache'))
  }

  public async makeInvidiousRequest<
    T extends InvidiousResponses.InvidiousApiResources,
    K extends InvidiousResponses.SearchTypes
  >(
    resource: T,
    search: InvidiousResponses.SearchObject<T, K>,
    authorization?: string | undefined,
    invalidateCache = false
  ): Promise<InvidiousResponses.ResponseType<T, K> | undefined> {
    let BASE_URL = loadSelectivePreference<string>('invidious_instance')

    if (BASE_URL) {
      if (!BASE_URL.startsWith('http')) {
        BASE_URL = 'https://' + BASE_URL
      }

      let parsedResource: string = resource
      if (search.params) {
        const matches = resource.matchAll(new RegExp(/\{(.*?)\}/g))
        if (matches) {
          for (const match of matches) {
            parsedResource = parsedResource.replaceAll(match[0], (search.params as { [key: string]: string })[match[1]])
          }
        }
      }

      const url = BASE_URL + '/api/v1/' + parsedResource
      const parsed = new URL(url)
      if (search.params) {
        for (const [key, value] of Object.entries(search.params)) {
          parsed.searchParams.set(key, value.toString())
        }
      }

      console.log(parsed.search)

      try {
        return await this.get(parsed, authorization, invalidateCache)
      } catch (e) {
        console.error('Error in invidious', e)
      }
    }
  }

  private get(parsed: URL, authorization?: string, invalidateCache = false) {
    if (!invalidateCache) {
      const cached = this.getCache(parsed.toString())
      if (cached) {
        const parsedCache = JSON.parse(cached)
        if (!parsedCache.error) return parsedCache
      }
    }

    return new Promise<never>((resolve, reject) => {
      const headers: { [key: string]: string } = { 'Content-Type': 'application/json' }
      if (authorization) {
        headers['Authorization'] = `Bearer ${authorization}`
      }

      const options: https.RequestOptions = {
        path: parsed.pathname + parsed.search,
        hostname: parsed.hostname,
        headers
      }

      const request = https.get(options, (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
            this.addToCache(parsed.toString(), data)
          } catch (e) {
            reject(e)
          }
        })
      })

      request.on('error', function (e) {
        reject(e.message)
      })

      request.end()
    })
  }
}
