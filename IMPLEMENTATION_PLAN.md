# Kanji desu - Implementation Plan
## Fastest Shipping Strategy (1-2 Week MVP)

### **Final Tech Stack Decision**
- **Framework**: SvelteKit (faster development, smaller bundles than React)
- **Styling**: Shadcn svelte (rapid UI development)
- **Furigana**: Kuroshiro.js + Kuromoji (client-side, no API dependencies)
- **Storage**: IndexedDB + storage.persist() (persistent local storage)
- **PWA**: SvelteKit's built-in PWA adapter
- **Deployment**: Vercel or Netlify (zero-config static deployment)
- **No Authentication**: Pure client-side app, no user accounts

### **MVP Feature Scope (1-2 weeks)**

#### Core Features
1. **Journaling Interface**
   - Clean text editor with real-time furigana overlay
   - Auto-save functionality every few seconds
   - Date-based entry organization
   - Simple navigation between entries

2. **Furigana Display System**
   - Real-time furigana generation as user types Japanese
   - Clean ruby text overlay above kanji characters
   - Toggle furigana visibility on/off
   - Handles mixed Japanese/English text gracefully

3. **Word Tracking & Storage**
   - Extract unique Japanese words from all entries
   - Store word usage frequency and first occurrence date
   - Simple word list view with search/filter
   - Persistent storage using IndexedDB with storage.persist()

### **Detailed Implementation Timeline**

#### **Days 1-2: Project Foundation**
- [X] Initialize SvelteKit project with TypeScript
- [X] Configure Tailwind CSS
- [X] Set up PWA configuration (manifest.json, service worker)
- [X] Install and configure Kuroshiro.js + Kuromoji (installed)
- [X] Create basic app structure and routing
- [X] Set up IndexedDB wrapper utilities

#### **Days 3-5: Core Editor Implementation**
- [X] Build main text editor component
- [X] Implement auto-save with debouncing
- [X] Create entry management (create, edit, delete)
- [X] Add date-based entry organization
- [X] Basic responsive layout for mobile/desktop
- [X] Create debug database view component
- [X] Set up word extraction and tracking system

#### **Days 6-8: Furigana Integration**
- [X] Integrate Kuroshiro.js for text analysis
- [X] Build furigana overlay component
- [X] Implement real-time furigana generation
- [PARTIAL] Handle text positioning and line wrapping (basic implementation done)
- [X] Add furigana toggle functionality
- [TODO] Optimize performance for long texts
- [BUG] Fix furigana display - currently shows same text instead of ruby tags

**NOTES FOR NEXT SESSION:**
- Check browser console for Kuroshiro output format to fix the conversion
- Consider testing with different Japanese text samples
- May need to handle different Kuroshiro output formats based on text complexity

#### **Days 9-11: Word Tracking System**
- [ ] Implement Japanese word extraction logic
- [ ] Create IndexedDB schema for words and entries
- [ ] Build word frequency tracking
- [ ] Create word list interface
- [ ] Add search and filter functionality

#### **Days 12-14: PWA Polish & Deployment**
- [ ] Finalize PWA configuration
- [ ] Implement storage.persist() for data persistence
- [ ] Add offline functionality
- [ ] Mobile UI/UX optimization
- [ ] Performance testing and optimization
- [ ] Deploy to production
- [ ] Cross-device testing

### **Technical Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                    SvelteKit App                            │
├─────────────────────────────────────────────────────────────┤
│  Routes:                                                    │
│  ├── / (main journal interface)                            │
│  ├── /words (word list view)                               │
│  └── /settings (app configuration)                         │
├─────────────────────────────────────────────────────────────┤
│  Components:                                                │
│  ├── TextEditor.svelte (main input with furigana)          │
│  ├── FuriganaOverlay.svelte (ruby text display)            │
│  ├── EntryList.svelte (journal entry navigation)           │
│  ├── WordList.svelte (tracked words interface)             │
│  └── PWAInstallPrompt.svelte (installation UI)             │
├─────────────────────────────────────────────────────────────┤
│  Services:                                                  │
│  ├── furigana.service.js (Kuroshiro integration)           │
│  ├── storage.service.js (IndexedDB operations)             │
│  ├── word-extractor.service.js (Japanese text analysis)    │
│  └── auto-save.service.js (debounced saving)               │
├─────────────────────────────────────────────────────────────┤
│  Storage Layer:                                             │
│  ├── IndexedDB (entries, words, settings)                  │
│  ├── storage.persist() (prevent data eviction)             │
│  └── Local backup/export functionality                     │
└─────────────────────────────────────────────────────────────┘
```

### **Data Models**

#### Journal Entry
```typescript
interface JournalEntry {
  id: string;
  date: Date;
  title?: string;
  content: string;
  wordCount: number;
  kanjiCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Tracked Word
```typescript
interface TrackedWord {
  id: string;
  word: string;
  reading: string;
  frequency: number;
  firstSeen: Date;
  lastUsed: Date;
  entryIds: string[]; // References to entries containing this word
}
```

### **Key Technical Decisions**

#### Why SvelteKit?
- **Faster Development**: Less boilerplate than React
- **Smaller Bundles**: Better performance on mobile
- **Built-in PWA Support**: Simplified PWA configuration
- **Great DX**: Excellent TypeScript support and dev tools

#### Why Kuroshiro.js?
- **Offline First**: No API dependencies or rate limits
- **Good Accuracy**: Handles 95%+ of common Japanese text correctly
- **Lightweight**: Reasonable bundle size for the functionality
- **Mature**: Well-maintained library with good documentation

#### Why IndexedDB + storage.persist()?
- **Large Storage**: Can handle extensive journal data
- **Persistence**: storage.persist() prevents browser data eviction
- **Performance**: Fast queries for word lookup and statistics
- **Offline**: Works completely offline

### **Performance Considerations**

1. **Lazy Loading**: Load Kuromoji dictionary only when needed
2. **Debounced Processing**: Limit furigana generation frequency
3. **Virtual Scrolling**: For large word lists
4. **Service Worker**: Cache static assets and dictionary data
5. **Bundle Splitting**: Separate chunks for core app vs. dictionary

### **Deployment Strategy**

#### Static Site Generation
- Build as static site with SvelteKit adapter-static
- Deploy to Vercel/Netlify for global CDN
- Automatic HTTPS and PWA optimization

#### PWA Features
- Offline functionality with service worker
- Install prompt for mobile/desktop
- App-like experience with proper manifest
- Background sync for future cloud features

### **Post-MVP Roadmap**

#### Week 3-4: Enhanced Learning
- [ ] Flashcard system with spaced repetition
- [ ] Word difficulty scoring
- [ ] Learning progress tracking

#### Week 5-6: Advanced Features
- [ ] Statistics dashboard
- [ ] Export to Anki/other SRS systems
- [ ] Progressive furigana removal based on familiarity

#### Week 7-8: Polish & Optimization
- [ ] Advanced text analysis (grammar patterns)
- [ ] Customizable furigana display options
- [ ] Improved mobile keyboard handling

#### Future Considerations
- [ ] Optional cloud sync (Firebase/Supabase)
- [ ] Collaborative features
- [ ] Integration with external dictionaries
- [ ] Voice input support

### **Risk Mitigation**

#### Technical Risks
- **Furigana Accuracy**: Kuroshiro handles most cases; fallback to manual correction
- **Storage Limits**: IndexedDB + storage.persist() provides reliable persistence
- **Performance**: Lazy loading and optimization strategies in place

#### User Experience Risks
- **Mobile Typing**: Extensive testing on various mobile keyboards
- **Data Loss**: Auto-save + export functionality
- **Offline Usage**: Full offline capability with service worker

### **Success Metrics for MVP**

1. **Functional**: Users can write journal entries with furigana
2. **Persistent**: Data survives browser restarts and updates
3. **Fast**: App loads in <3 seconds on mobile
4. **Usable**: Works well on both desktop and mobile
5. **Installable**: Can be installed as PWA on devices

This plan prioritizes speed of development while maintaining a solid foundation for future features. The SvelteKit + Kuroshiro.js combination provides the fastest path to a working Japanese journaling app with furigana support.