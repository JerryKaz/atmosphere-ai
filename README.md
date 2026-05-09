# Atmosphere AI v2.0

**Atmosphere AI** is a sophisticated weather intelligence platform that blends real-time atmospheric data with generative AI insights. Built with a focus on aesthetic precision and functional utility, it provides users with more than just temperature readings it offers curated advice for living in harmony with the current environment.

##  Key Features

- **Atmospheric intelligence (AI Advisor):** Leverages the Google Gemini API to provide personalized "Selected Attire" and "Curated Activities" recommendations based on current weather, UV index, and wind conditions.
- **Micro-Animations:** A highly dynamic UI powered by Framer Motion, featuring weather-responsive icons (glinting suns, drifting snow, pulsing fog) and smooth state transitions.
- **Deep Historical Context:** View atmospheric trends from the past 7 days using Recharts to visualize temperature and precipitation fluctuations.
- **Fuzzy Search & Recent History:** Advanced location searching using `Fuse.js` for typo-tolerance, plus a persistent history of your last 5 searched locations.
- **Robust Offline Mode:** Built-in caching mechanisms allow the app to function without an internet connection, clearly displaying the last synchronization timestamp.
- **Sharing Integration:** Quickly share current atmospheric states and AI recommendations via the native Web Share API or system clipboard.
- **Dark/Light Harmony:** A meticulously crafted dual-theme system that adapts to user preference while maintaining high legibility and aesthetic consistency.

##  Technical Stack

- **Frontend:** React 19 + TypeScript
- **Styling:** Tailwind CSS 4.0
- **Animations:** Framer Motion (motion/react)
- **Intelligence:** Google Gemini API (@google/genai)
- **Data Engine:** Open-Meteo API (Weather & Geocoding)
- **Visualization:** Recharts
- **Search Logic:** Fuse.js
- **Icons:** Lucide React

##  Getting Started

### Prerequisites
- Node.js (v18 or higher)
- A Google Gemini API Key

### Configuration
1. Clone the repository.
2. Define your environment variables in a `.env` file:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

### Execution
```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

## Design Philosophy
Atmosphere AI follows a "Natural Minimalist" design language. It avoids generic gradients and standard shadows in favor of subtle borders, backdrop blurs, and intentional typography pairings (Inter for UI, Space Grotesk for metrics).

##  Credits
**Designed and Developed by [Jerry Myron](https://github.com/JerryKaz)**
Created in the Aesthetic Intelligence Laboratory.

---
© 2026 Atmosphere AI • Earth Elements Dataset v2.0
