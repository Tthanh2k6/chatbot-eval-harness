# Quillnote Offline Sync

Quillnote supports full offline editing on desktop (Windows, macOS, Linux) and mobile (iOS, Android) apps using an encrypted local SQLite database. By default, up to 5,000 notes or 2 GB of file attachments are cached locally on your device for offline access. In the web browser, offline mode stores up to 500 recent notes in IndexedDB when offline caching is enabled in Settings.

When an internet connection is restored after working offline, Quillnote automatically syncs pending offline changes within 5 seconds using delta synchronization. While connected to the internet, background sync runs every 30 seconds or immediately whenever a note is closed. Individual file attachments up to 25 MB are synced over cellular networks, while attachments up to 100 MB require Wi-Fi unless cellular large-file sync is enabled.

If the same note is edited offline on two different devices before reconnecting, Quillnote resolves offline sync conflicts by preserving both versions using a conflict copy mechanism. The latest timestamp wins as the primary note, and the competing version is saved in the "Sync Conflicts" notebook with a `[Conflict]` prefix in its title so no text is ever lost.
