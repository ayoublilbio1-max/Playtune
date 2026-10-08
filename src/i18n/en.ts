/**
 * English (the reference). Every other language must have the same keys.
 * {name} parts are filled in by t(); "_one" / "_other" pairs are picked by tn() from a count.
 */
export const en = {
  // Common
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.delete": "Delete",
  "common.remove": "Remove",
  "common.close": "Close",
  "common.create": "Create",
  "common.ok": "OK",
  "common.play": "Play",
  "common.newPlaylist": "New playlist",
  "common.playlistName": "Playlist name",
  "common.likedSongs": "Liked songs",
  "common.unknownSong": "Unknown song",
  "common.unknownArtist": "Unknown artist",
  "common.unknownAlbum": "Unknown album",

  // Counts
  songs_one: "{count} song",
  songs_other: "{count} songs",
  albums_one: "{count} album",
  albums_other: "{count} albums",
  artists_one: "{count} artist",
  artists_other: "{count} artists",
  folders_one: "{count} folder",
  folders_other: "{count} folders",
  playlists_one: "{count} playlist",
  playlists_other: "{count} playlists",
  results_one: "{count} result",
  results_other: "{count} results",

  // Menu
  "menu.playlists": "Playlists",
  "menu.nowPlaying": "Now playing",
  "menu.queue": "Queue",
  "menu.equalizer": "Equalizer",
  "menu.sleepTimer": "Sleep timer",
  "menu.settings": "Settings",

  // Home
  "home.search": "Search songs, artists...",
  "home.noMatch": "Nothing matches your search.",
  "home.noSongs": "No songs found on this phone.",
  "browse.songs": "Songs",
  "browse.albums": "Albums",
  "browse.artists": "Artists",
  "browse.folders": "Folders",
  "browse.album": "Album",
  "browse.artist": "Artist",
  "browse.folder": "Folder",
  "browse.unknownFolder": "Unknown folder",
  "browse.gone": "These songs are not on the phone anymore.",

  // Permission
  "perm.title": "Allow access to your music",
  "perm.blocked":
    "Access was denied. Turn it on in Settings › Apps › Playtune › Permissions.",
  "perm.why": "Playtune needs it to find the songs on your phone.",
  "perm.allow": "Allow",

  // Sort
  "sort.heading": "Sort songs by",
  "sort.title": "Song name",
  "sort.artist": "Artist",
  "sort.album": "Album",
  "sort.year": "Year",
  "sort.duration": "Duration",
  "sort.size": "Size",
  "sort.newest": "Newest added",
  "sort.oldest": "Oldest added",
  "sort.az": "A to Z",
  "sort.yearHint": "Newest first",
  "sort.durationHint": "Longest first",
  "sort.sizeHint": "Largest first",
  "sort.newestHint": "Last added first",
  "sort.oldestHint": "First added first",

  // Song sheet
  "sheet.playNext": "Play next",
  "sheet.addToQueue": "Add to queue",
  "sheet.hide": "Hide",
  "sheet.addToPlaylist": "Add to playlist",
  "sheet.alreadyAdded": "Already added",

  // Player
  "player.nothingTitle": "Nothing is playing",
  "player.nothingText": "Pick a song in your library to start.",
  "player.share": "Share song",
  "player.songInfo": "Song info",
  "info.title": "Title",
  "info.artist": "Artist",
  "info.album": "Album",
  "info.year": "Year",
  "info.duration": "Duration",
  "info.format": "Format",
  "info.size": "Size",
  "info.file": "File",
  "info.folder": "Folder",

  // Queue
  "queue.summary": "{songs} · up next: {next} ({time})",
  "queue.emptyTitle": "The queue is empty",
  "queue.emptyText": "Play a song, or use “Add to queue” from a song’s menu.",
  "queue.playNow": "Play now",
  "queue.moveUp": "Move up",
  "queue.moveDown": "Move down",
  "queue.remove": "Remove from queue",

  // Playlists
  "playlists.count": "{count} + {liked}",
  "playlists.createFirst": "Create your first playlist",
  "playlist.gone": "This playlist doesn’t exist anymore.",
  "playlist.addSongs": "Add songs",
  "playlist.addTo": "Add to {name}",
  "playlist.empty": "No songs yet. Tap “Add songs” to fill this playlist.",
  "playlist.rename": "Rename playlist",
  "playlist.delete": "Delete playlist",
  "playlist.deleteTitle": "Delete playlist?",
  "playlist.deleteText":
    "“{name}” will be deleted. Your songs stay on the phone.",
  "playlist.removeTitle": "Remove from playlist?",
  "playlist.removeText": "“{title}” stays on your phone.",
  "playlist.selectSongs": "Select songs",
  "playlist.addCount_one": "Add {count} song",
  "playlist.addCount_other": "Add {count} songs",

  // Equalizer
  "eq.on": "On — applies to every song",
  "eq.off": "Off",
  "eq.custom": "Custom",
  "eq.unsupported": "This phone doesn’t support an equalizer.",
  "eq.bass": "Bass boost",
  "eq.virtualizer": "Virtualizer",

  // Sleep timer
  "sleep.heading": "Stop music after",
  "sleep.hours": "hours",
  "sleep.minutes": "min",
  "sleep.seconds": "sec",
  "sleep.pick": "Pick a time",
  "sleep.start": "Start · {time}",
  "sleep.until": "until the music stops",
  "sleep.note":
    "The music fades out during the last 10 seconds, then pauses. The timer keeps running when you leave the app.",
  "sleep.turnOff": "Turn off",

  // Settings
  "settings.appearance": "Appearance",
  "settings.lightTheme": "Light theme",
  "settings.on": "On",
  "settings.off": "Off",
  "settings.darkOn": "Off — dark theme",
  "settings.language": "Language",
  "settings.playback": "Playback",
  "settings.pauseOnDetach": "Pause on detach",
  "settings.pauseOnDetachHint": "Pause when headphones or Bluetooth disconnect",
  "settings.pauseOnDetachLater":
    "Saved — this app version still pauses; it takes effect after the next update",
  "settings.library": "Library",
  "settings.skipShort": "Skip short songs",
  "settings.skipShortOff": "Every audio file is shown",
  "settings.skipShortOn":
    "Hides files shorter than {seconds} seconds (voice notes, ringtones)",
  "settings.rescan": "Rescan library",
  "settings.scanning": "Scanning…",
  "settings.onPhone": "{songs} on this phone",
  "settings.allowFirst": "Allow access to your music first (on Home)",
  "settings.hideMusic": "Hide music",
  "settings.hideMusicHint": "Hide songs you don’t want to see in the app",
  "settings.hiddenCount_one": "{count} song hidden",
  "settings.hiddenCount_other": "{count} songs hidden",
  "settings.transfer": "Transfer music",
  "settings.transferHint": "Send your songs to another phone",
  "settings.storage": "Storage",
  "settings.clearCache": "Clear artwork cache",
  "settings.clearCacheHint":
    "Deletes the saved cover pictures. They are made again when needed.",
  "settings.clearTitle": "Clear artwork cache?",
  "settings.clearText":
    "The saved cover pictures are deleted. Your songs and playlists are not touched.",
  "settings.clear": "Clear",
  "settings.help": "Help",
  "settings.feedback": "Feedback",
  "settings.feedbackHint": "Report a bug or tell us what to improve",
  "settings.terms": "Terms of use",
  "settings.about": "About",
  "settings.aboutText":
    "Plays the music saved on your phone. No account, no internet needed.",
  "settings.version": "Version {version}",

  // Feedback
  "feedback.title": "Send feedback",
  "feedback.text":
    "Found a bug or have an idea to make Playtune better? Contact me on Fiverr ({developer}) and tell me what happened.",
  "feedback.include": "Please add this to your message:",

  // Hide music
  "hide.intro":
    "Tap a song to hide it from the library, playlists, albums and search. The file stays on your phone.",
  "hide.all": "All ({count})",
  "hide.hidden": "Hidden ({count})",
  "hide.none": "No hidden songs.",
  "hide.showAll": "Show all",

  // Transfer
  "transfer.title": "Move your music to another phone",
  "transfer.lead":
    "Send your songs and playlists to a phone nearby. Both phones need Playtune open.",
  "transfer.whatGoes": "What will be sent",
  "transfer.note": "Songs are copied, nothing is removed from this phone.",
  "transfer.send": "Send music",
  "transfer.sendHint": "From this phone to another one",
  "transfer.receive": "Receive music",
  "transfer.receiveHint": "From another phone to this one",

  // Not in the demo
  "demo.title": "Not in the demo",
  "demo.text": "This feature is not part of the demo version of Playtune.",
  "demo.textFeature":
    "“{feature}” is not part of the demo version of Playtune.",

  // Terms of use
  "terms.updated": "Playtune {version}",
  "terms.intro": "By using Playtune you agree to these terms.",
  "terms.useTitle": "Using the app",
  "terms.useBody":
    "Playtune plays the audio files that are already saved on your phone. It is for personal use.",
  "terms.musicTitle": "Your music",
  "terms.musicBody":
    "You are responsible for the music files on your phone and for having the right to play and share them. Playtune does not sell or provide music.",
  "terms.privacyTitle": "Privacy",
  "terms.privacyBody":
    "Playtune has no account and sends nothing to the internet. Your playlists, likes and settings are saved only on this phone.",
  "terms.permissionsTitle": "Permissions",
  "terms.permissionsBody":
    "Music access is used to find your songs. Notifications show the player controls. Nothing else is read.",
  "terms.warrantyTitle": "No warranty",
  "terms.warrantyBody":
    "The app is provided “as is”. The developer is not responsible for lost files or data, or for problems caused by using the app.",
  "terms.changesTitle": "Changes",
  "terms.changesBody": "These terms can change with new versions of the app.",
  "terms.contactTitle": "Contact",
  "terms.contactBody": "Questions or problems: contact {developer} on Fiverr.",

  "lyrics.title": "Lyrics",
  "lyrics.synced": "Synced",
  "lyrics.noneTitle": "No lyrics in this song",
  "lyrics.noneText":
    "Lyrics are read from the song file (MP3, FLAC, M4A tags). Add them with a tag editor — lines with [mm:ss] times scroll with the music.",
  "lyrics.updateTitle": "Lyrics need the new app version",
  "lyrics.updateText":
    "This version of Playtune can’t read lyrics yet. Install the latest update to see them.",

  "common.done": "Done",
  "reorder.title": "Reorder",
  "reorder.hint": "Hold ≡ and drag a song to move it.",
  "home.recent": "Recently played",
  "home.most": "Most played",
  "select.count": "{count} selected",
  "select.all": "Select all",
  "select.none": "Select none",
  "select.play": "Play",
  "toast.hiddenMany_one": "Hid {count} song",
  "toast.hiddenMany_other": "Hid {count} songs",
  "toast.addedSongsTo_one": "Added {count} song to {name}",
  "toast.addedSongsTo_other": "Added {count} songs to {name}",
  "feedback.open": "Open my Fiverr profile",
  "toast.linkFailed": "Could not open the link",
  "settings.clearHistory": "Clear listening history",
  "settings.clearHistoryHint": "Empties Recently played and Most played",
  "settings.clearHistoryTitle": "Clear listening history?",
  "settings.clearHistoryText":
    "Recently played and Most played start again from zero. Your songs and playlists are not touched.",
  "toast.historyCleared": "Listening history cleared",

  "home.recentEmpty":
    "Songs you listen to for 15 seconds or more show up here.",
  "most.plays": "{count}×",
  "most.emptyTitle": "No plays yet",
  "most.emptyText":
    "Listen to songs for 15 seconds or more and your favourites will rank here.",

  // Toasts
  "toast.addedTo": "Added to {name}",
  "toast.alreadyIn": "Already in {name}",
  "toast.addedSongs_one": "Added {count} song",
  "toast.addedSongs_other": "Added {count} songs",
  "toast.created": "Created {name}",
  "toast.deleted": "Deleted {name}",
  "toast.liked": "Added to Liked songs",
  "toast.unliked": "Removed from Liked songs",
  "toast.shareFailed": "Could not share this song",
  "toast.playing": "Playing",
  "toast.playNext": "Plays next",
  "toast.addedToQueue": "Added to the queue",
  "toast.removedFromQueue": "Removed {title} from the queue",
  "toast.hidden": "Hid {title}",
  "toast.sleepStart": "Music stops in {time}",
  "toast.sleepExtended": "5 minutes added",
  "toast.sleepOff": "Sleep timer off",
  "toast.found_one": "Found {count} song",
  "toast.found_other": "Found {count} songs",
  "toast.scanFailed": "Could not scan the library",
  "toast.clearedPictures_one": "Cleared {count} picture",
  "toast.clearedPictures_other": "Cleared {count} pictures",
  "toast.clearFailed": "Could not clear the pictures",
  "toast.nextUpdate": "Saved. It takes effect after the next app update.",
} as const;
