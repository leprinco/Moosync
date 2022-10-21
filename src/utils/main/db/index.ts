/*
 *  index.ts is a part of Moosync.
 *
 *  Copyright 2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
 *  Licensed under the GNU General Public License.
 *
 *  See LICENSE in the project root for license information.
 */

import { FAVORITES_PLAYLIST_ID } from '@/utils/commonConstants'
import { SongDBInstance } from './database'

export const SongDB = new SongDBInstance()

function createFavoritesPlaylist() {
  const isExist = !!SongDB.getEntityByOptions<Playlist>({
    playlist: {
      playlist_id: FAVORITES_PLAYLIST_ID
    }
  })[0]

  if (!isExist) {
    SongDB.createPlaylist({
      playlist_id: FAVORITES_PLAYLIST_ID,
      playlist_name: 'Favorites',
      playlist_desc: 'Playlist containing your favorite songs'
    })
  }
}

createFavoritesPlaylist()
