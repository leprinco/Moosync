/*
 *  migrations.ts is a part of Moosync.
 *
 *  Copyright 2021-2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
 *  Licensed under the GNU General Public License.
 *
 *  See LICENSE in the project root for license information.
 */

export const migrations = [
  // All Songs
  ` 
  -- Up
  CREATE TABLE allsongs (
    _id VARCHAR(36) PRIMARY KEY,
    path TEXT,
    size NUMBER,
    inode TEXT,
    deviceno TEXT,
    title TEXT,
    date TEXT,
    year TEXT,
    lyrics TEXT,
    releaseType TEXT,
    bitrate NUMBER,
    codec TEXT,
    container TEXT,
    duration NUMBER,
    sampleRate NUMBER,
    hash TEXT
  );
  -- Down
  DROP TABLE IF EXISTS 'allsongs';
  `,

  // Artists
  `
  -- Up
  CREATE TABLE artists (
    artist_id VARCHAR(36) PRIMARY KEY,
    artist_mbid TEXT,
    artist_name TEXT,
    artist_coverPath TEXT
  );

  CREATE TABLE artists_bridge (
    id integer PRIMARY KEY AUTOINCREMENT,
    song VARCHAR(36),
    artist VARCHAR(36),
    FOREIGN KEY(song) REFERENCES allsongs(_id),
    FOREIGN KEY(artist) REFERENCES artists(artist_id)
  );

  -- Down
  DROP TABLE IF EXISTS 'artists_bridge';
  DROP TABLE IF EXISTS 'artists';
  `,

  // Genre
  `
  -- Up
  CREATE TABLE genre (
    genre_id VARCHAR(36) PRIMARY KEY,
    genre_name text
  ); 

  CREATE TABLE genre_bridge (
    id integer PRIMARY KEY AUTOINCREMENT,
    song VARCHAR(36),
    genre VARCHAR(36),
    FOREIGN KEY(song) REFERENCES allsongs(_id),
    FOREIGN KEY(genre) REFERENCES genre(genre_id)
  );
  -- Down
  DROP TABLE IF EXISTS 'genre_bridge';
  DROP TABLE IF EXISTS 'genre';
  `,

  // Albums
  `
  -- Up
  CREATE TABLE albums (
    album_id VARCHAR(36) PRIMARY KEY,
    album_name TEXT,
    album_artist TEXT,
    album_coverPath TEXT
  );

  CREATE TABLE album_bridge (
    id integer PRIMARY KEY AUTOINCREMENT,
    song VARCHAR(36),
    album VARCHAR(36),
    FOREIGN KEY(song) REFERENCES allsongs(_id),
    FOREIGN KEY(album) REFERENCES albums(album_id)
  );

  -- Down
  DROP TABLE IF EXISTS 'album_bridge';
  DROP TABLE IF EXISTS 'albums';
  `,

  // Playlists
  `
  -- Up
  CREATE TABLE playlists (
    playlist_id VARCHAR(36) PRIMARY KEY,
    playlist_name TEXT NOT NULL,
    playlist_coverPath TEXT
  );

  CREATE TABLE playlist_bridge (
    id integer PRIMARY KEY AUTOINCREMENT,
    song VARCHAR(36),
    playlist VARCHAR(36),
    FOREIGN KEY(song) REFERENCES allsongs(_id),
    FOREIGN KEY(playlist) REFERENCES playlists(playlist_id)
  );

  -- Down
  DROP TABLE IF EXISTS 'playlist_bridge';
  DROP TABLE IF EXISTS 'playlists';
    `,

  // 04-03-2021
  `
  -- Up
  ALTER TABLE albums ADD album_song_count NUMBER NOT NULL DEFAULT 0;
  ALTER TABLE albums ADD year TEXT;
  ALTER TABLE artists ADD artist_song_count NUMBER NOT NULL DEFAULT 0;
  ALTER TABLE playlists ADD playlist_song_count NUMBER NOT NULL DEFAULT 0;
  ALTER TABLE genre ADD genre_song_count NUMBER NOT NULL DEFAULT 0;

  -- Down
  `,

  // 05-03-2021
  `
  -- Up
  ALTER TABLE allsongs ADD type TEXT NOT NULL DEFAULT 'LOCAL';
  ALTER TABLE allsongs ADD url TEXT;

  -- Down
  `,

  // 02-06-2021
  `
  -- Up
  ALTER TABLE playlists ADD playlist_desc TEXT;

  -- Down
  `,

  // 02-07-2021
  `
  -- Up
  ALTER TABLE allsongs ADD song_coverPath TEXT;

  -- Down
  `,

  // 04-08-2021
  `
  -- Up
  ALTER TABLE allsongs ADD playbackUrl TEXT;

  -- Down
  `,

  // 04-08-2021
  `
  -- Up
  ALTER TABLE allsongs RENAME COLUMN song_coverPath TO song_coverPath_high;
  ALTER TABLE allsongs ADD song_coverPath_low TEXT;

  ALTER TABLE albums RENAME COLUMN album_coverPath TO album_coverPath_high;
  ALTER TABLE albums ADD album_coverPath_low TEXT;
  -- Down
  `,

  // 26-08-2021
  `
  -- Up
  ALTER TABLE allsongs ADD date_added TEXT DEFAULT "0";

  -- Down
  `,

  // 21-03-2022
  `
  -- Up
  ALTER TABLE playlists ADD playlist_path TEXT;

  -- Down
  `,

  // 26-03-2022
  `
  -- Up
  ALTER TABLE allsongs ADD provider_extension TEXT;

  -- Down
  `,

  // 10-04-2022
  `
  -- Up
  ALTER TABLE allsongs ADD icon TEXT;

  -- Down
  `,

  // 10-06-2022
  `
  -- Up
  ALTER TABLE artists ADD artist_extra_info TEXT;

  -- Down
  `,

  // 25-06-2022
  `
  -- Up
  ALTER TABLE albums ADD album_extra_info TEXT;

  -- Down
  `,

  // 10-10-2022
  `
  -- Up
  CREATE TABLE analytics (
    id VARCHAR(36) PRIMARY KEY,
    song_id VARCHAR(36),
    play_count INTEGER
  );

  -- Down
  `,

  // 11-10-2022
  `
  -- Up
  ALTER TABLE playlists ADD extension TEXT;

  -- Down
  `,

  // 18-10-2022
  `
  -- Up
  ALTER TABLE playlists ADD icon TEXT;

  -- Down
  `,

  // 21-10-2022
  `
  -- Up
  ALTER TABLE allsongs add show_in_library BOOLEAN DEFAULT TRUE;

  -- Down
  `,

  // 24-12-2022
  `
  -- Up
  ALTER TABLE artists_bridge RENAME TO artist_bridge;
  
  -- Down
  `,

  // 24-12-2022
  `
  -- Up
  ALTER TABLE genre RENAME TO genres;
  
  -- Down
  `,

  // 29-12-2022
  `
  -- Up
  ALTER TABLE allsongs ADD track_no NUMBER DEFAULT 0;
  
  -- Down
  `,

  // 07-01-2023
  `
  -- Up
  ALTER TABLE analytics ADD play_time NUMBER DEFAULT 0;
  
  -- Down
  `,

  // 19-03-2023
  `
  -- Up
  ALTER TABLE artists ADD sanitized_artist_name TEXT;
  
  -- Down
  `,

  // 04-06-2023
  `
  -- Up
  CREATE UNIQUE INDEX path_uq ON allsongs(path);

  CREATE UNIQUE INDEX sanitized_artist_name_uq ON artists(sanitized_artist_name);
  CREATE UNIQUE INDEX album_name_uq ON albums(album_name);
  CREATE UNIQUE INDEX genre_name_uq ON genres(genre_name);

  CREATE UNIQUE INDEX artist_bridge_uq ON artist_bridge(song, artist);
  CREATE UNIQUE INDEX album_bridge_uq ON album_bridge(song, album);
  CREATE UNIQUE INDEX genre_bridge_uq ON genre_bridge(song, genre);
  
  -- Down
  `,

  // 04-07-2023
  `
  -- Up
  CREATE TRIGGER increment_artist_count AFTER INSERT ON artist_bridge
  BEGIN
    UPDATE artists
    SET artist_song_count = artist_song_count + 1
    WHERE artist_id = NEW.artist;
  END;

  CREATE TRIGGER decrement_artist_count AFTER DELETE ON artist_bridge
  BEGIN
    UPDATE artists
    SET artist_song_count = artist_song_count - 1
    WHERE artist_id = OLD.artist;
  END;

  CREATE TRIGGER increment_album_count AFTER INSERT ON album_bridge
  BEGIN
    UPDATE albums
    SET album_song_count = album_song_count + 1
    WHERE album_id = NEW.album;
  END;

  CREATE TRIGGER decrement_album_count AFTER DELETE ON album_bridge
  BEGIN
    UPDATE albums
    SET album_song_count = album_song_count - 1
    WHERE album_id = OLD.album;
  END;

  CREATE TRIGGER increment_genre_count AFTER INSERT ON genre_bridge
  BEGIN
    UPDATE genres
    SET genre_song_count = genre_song_count + 1
    WHERE genre_id = NEW.genre;
  END;

  CREATE TRIGGER decrement_genre_count AFTER DELETE ON genre_bridge
  BEGIN
    UPDATE genres
    SET genre_song_count = genre_song_count - 1
    WHERE genre_id = OLD.genre;
  END;

  CREATE TRIGGER increment_playlist_count AFTER INSERT ON playlist_bridge
  BEGIN
    UPDATE playlists
    SET playlist_song_count = playlist_song_count + 1
    WHERE playlist_id = NEW.playlist;
  END;

  CREATE TRIGGER decrement_playlist_count AFTER DELETE ON playlist_bridge
  BEGIN
    UPDATE playlists
    SET playlist_song_count = playlist_song_count - 1
    WHERE playlist_id = OLD.playlist;
  END;

  -- Down
  DROP TRIGGER IF EXISTS increment_artist_count;
  DROP TRIGGER IF EXISTS decrement_artist_count;

  DROP TRIGGER IF EXISTS increment_album_count;
  DROP TRIGGER IF EXISTS decrement_album_count;

  DROP TRIGGER IF EXISTS increment_genre_count;
  DROP TRIGGER IF EXISTS decrement_genre_count;

  DROP TRIGGER IF EXISTS increment_playlist_count;
  DROP TRIGGER IF EXISTS decrement_playlist_count;
  `,
]
