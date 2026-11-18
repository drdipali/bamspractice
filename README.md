# BAMS Practice Builder - Mobile Application

A mobile-friendly, responsive native application for Ayurveda students and practitioners preparing for competitive exams (AIAPGET, State PSCs, etc.).

## Tech Stack
- **Framework**: React Native with Expo SDK 52
- **Language**: TypeScript
- **State & Storage**: React Context + `@react-native-async-storage/async-storage`
- **Icons**: `lucide-react-native`
- **UI & Layout**: Custom mobile-first responsive design matching classical Ayurvedic typography (Newsreader, Noto Sans Devanagari)

## Directory Structure
- `src/constants/`: Theme tokens, classical Samhita syllabus tree, and question bank.
- `src/types/`: TypeScript definitions for questions, chapters, allocations, and sessions.
- `src/utils/`: Question allocation algorithms (pooled, equal, proportional, manual) and storage services.
- `src/context/`: Unified state management.
- `src/components/`: Modular screens and sub-components.

## Getting Started
```bash
# Start Metro bundler / Expo dev server
npm run start

# Launch on web
npm run web

# Launch on Android emulator
npm run android

# Launch on iOS simulator
npm run ios
```
