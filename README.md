# Kanji desu
============

Kanjidesu is an app for studying japanese kanji via active output - daily journaling.
Use kanjidesu on your phone or computer to type your daily journal entries and notes.
Kanjidesu shows furigana on top of what you type, and tracks every kanji that you use.
Review flashcards with your kanji, separate and in context of your own sentences.
As you learn each separate kanji, furigana on top of it slowly dissipates, eventually disappearing.

Main elements:
- notes taking/viewing interface that dynamically shows furigana
- your own word list compiled from every word that you used
- statistics view for your words - word count, frequency
- flashcard drill interface

## Technical implementation
Its tempting to build this as a SwiftUI app, however SwiftUI lacks features for furigana display. The best possible solution for SwuftUI seems to be using WKWebView to display bits of text as html with <ruby> tags.

Alternatively, we can build a web app with login and stuff. That would enable better access to the app, but require authentication and stuff. Solved kinda fast by using firebase or supabase. For web app we'd use svelte.

Lastly, we can use svelte and Tauri to build a hybrid native/web app. On the surface we wouldn't need any auth and server stuff, but we would need something to sync user data between devices, going back to having to have auth an accounts.

Considering that there are many japanese learners amounr Android and Winows users, seems like web app is the way to go.

Lastly there is an option to use React Native (Expo) an also the WebView hack to render furigana.

