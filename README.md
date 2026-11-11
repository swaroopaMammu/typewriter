# TypeWriter

Type Manglish, get Malayalam. Write novels in sections, read them as one book, download them.

    npm install
    npm run dev      # http://localhost:5173
    npm test         # transliteration engine tests
    npm run build    # static site in dist/

Data is stored in your browser (IndexedDB). Use Download > Backup (.json) regularly.
Typing guide: open it from the writer toolbar. Ctrl+M toggles Malayalam/English.

## Android app (.apk)

    bash build-apk.sh

Finds Android Studio's JDK and SDK, builds the web app, syncs it into `android/`, runs Gradle and
writes `TypeWriter.apk` next to this file. Copy it to the phone and open it (allow "install unknown apps").
The Android project is a Capacitor app: after web changes run `npm run build && npx cap sync android`,
and you can also open the `android/` folder in Android Studio and press Run.

## Types
Novel = chapters of prose. Screenplay = Scene 1, 2, 3… each with INT./EXT., location and time of day.
Write dialogue as `NAME: what they say`.
