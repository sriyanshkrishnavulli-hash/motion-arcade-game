import { useEffect, useRef, useState } from 'react'
import { Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, CameraOff, CircleHelp, Download, Gamepad2, Maximize2, Minimize2, Music2, Palette, Play, RotateCcw, Sparkles, Star, Volume2, VolumeX, X, Zap } from 'lucide-react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import './App.css'

type PoseControl = { lean: number; jump: boolean; crouch: boolean; detected: boolean }
type GameMode = 'dance' | 'runner' | 'catcher' | 'pose' | 'storm'
type Language = 'en' | 'hi' | 'kn' | 'te' | 'ta' | 'ml'
type ColorTheme = 'arcade' | 'rainbow' | 'warm' | 'cool'
type MusicStyle = 'arcade' | 'chiptune' | 'synthwave' | 'drumBass'
type ChallengeAction = 'left' | 'right' | 'jump' | 'duck'
type Obstacle = { x: number; y: number; size: number; hue: number; kind: 'block' | 'star' | 'bomb' | 'orb' | 'beam' }
type Runtime = { mode: GameMode; x: number; jumpY: number; jumpVelocity: number; obstacles: Obstacle[]; lastSpawn: number; lastTime: number; score: number; jumpWasDown: boolean; crashed: boolean; secondsLeft: number; challenge: ChallengeAction; nextChallengeAt: number }
type CameraStatus = 'idle' | 'loading' | 'live' | 'error'
type PoseWorkerResponse = { type: 'ready' } | { type: 'pose'; landmarks: NormalizedLandmark[] | null } | { type: 'error'; message: string }
type ArcadeMusic = { context: AudioContext; master: GainNode; noise: AudioBuffer; timer: number; nextStep: number; step: number; style: MusicStyle }
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }> }

const SKELETON: [number, number][] = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 29], [29, 31], [28, 30], [30, 32]]
const EMPTY_CONTROL: PoseControl = { lean: 0, jump: false, crouch: false, detected: false }
const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'ml', label: 'മലയാളം' },
]
const COLOR_THEMES: { code: ColorTheme; label: string }[] = [
  { code: 'arcade', label: 'Arcade' },
  { code: 'rainbow', label: 'Rainbow' },
  { code: 'warm', label: 'Warm' },
  { code: 'cool', label: 'Cool' },
]
const MUSIC_STYLES: { code: MusicStyle; label: string }[] = [
  { code: 'arcade', label: 'Arcade' },
  { code: 'chiptune', label: 'Chiptune' },
  { code: 'synthwave', label: 'Synthwave' },
  { code: 'drumBass', label: 'Drum & Bass' },
]
const TRANSLATIONS: Record<Exclude<Language, 'en'>, Record<string, string>> = {
  hi: {
    'BODY-POWERED PLAY': 'शरीर से खेलें', 'Move your body.': 'शरीर हिलाएँ।', 'Move the game.': 'खेल चलाएँ।', 'No controller needed.': 'कंट्रोलर की ज़रूरत नहीं।', 'Just step into frame and play.': 'कैमरे के सामने आएँ और खेलें।',
    'MINI GAMES': 'छोटे खेल', 'Dino Dance Run': 'डायनासोर डांस रन', 'Copy steps, dodge blocks': 'स्टेप करें, रुकावटों से बचें', 'DANCE': 'डांस', 'Neon Runner': 'नियॉन रनर', 'Dodge, jump, duck': 'बचें, कूदें, झुकें', 'REFLEX': 'फुर्ती', 'Star Catch': 'तारे पकड़ें', 'Catch stars, avoid bombs': 'तारे पकड़ें, बमों से बचें', 'COLLECT': 'इकट्ठा करें', 'Pose Match': 'पोज़ मिलाएँ', 'Copy the pose prompt': 'दिखाई गई मुद्रा करें', 'QUICK REACT': 'जल्दी करें',
    'DANCE SCORE': 'डांस अंक', 'STARS CAUGHT': 'पकड़े तारे', 'MOVES MATCHED': 'मिले हुए स्टेप', 'YOUR SCORE': 'आपके अंक', 'IN PLAY': 'खेल जारी', 'STANDBY': 'तैयार', 'ROUND 01': 'राउंड ०१', 'SEC': 'सेकंड', 'YOUR MOVE': 'आपकी चाल', 'START RUN': 'दौड़ शुरू करें', 'END RUN': 'दौड़ रोकें', 'PLAY AGAIN': 'फिर खेलें', 'MUSIC ON': 'संगीत चालू', 'MUSIC OFF': 'संगीत बंद', 'Mute music': 'संगीत बंद करें', 'Enable music': 'संगीत चालू करें',
    'Copy each dance step, dodge blocks, and run to the beat.': 'हर डांस स्टेप करें, रुकावटों से बचें और ताल पर दौड़ें।', 'Dodge blocks. Raise your hands to jump; crouch to duck.': 'रुकावटों से बचें। कूदने के लिए हाथ उठाएँ, झुकने के लिए नीचे बैठें।', 'Move under the falling stars. Catch gold, avoid red bombs.': 'गिरते तारों के नीचे जाएँ। सुनहरे तारे पकड़ें, लाल बमों से बचें।', 'Copy the prompt before it changes. Match each move for 100 points.': 'बदलने से पहले चाल करें। हर सही चाल के १०० अंक।',
    'PLAYER TRACKING': 'खिलाड़ी ट्रैकिंग', 'Step into frame': 'कैमरे के सामने आएँ', 'LIVE': 'चालू', 'LOADING': 'लोड हो रहा है', 'ERROR': 'त्रुटि', 'OFFLINE': 'बंद', 'Warming up the camera': 'कैमरा शुरू हो रहा है', 'Could not connect': 'कनेक्ट नहीं हुआ', 'Camera is waiting': 'कैमरा तैयार है', 'Full body in frame works best': 'पूरा शरीर कैमरे में रखें', 'Loading the pose model and asking permission': 'मॉडल लोड हो रहा है और अनुमति माँगी जा रही है', 'CONNECT CAMERA': 'कैमरा जोड़ें', 'CONNECTING...': 'जुड़ रहा है...', 'DISCONNECT CAMERA': 'कैमरा हटाएँ', 'BODY POSITION': 'शरीर की स्थिति', 'POSE DETECTED': 'मुद्रा मिली', 'SEARCHING': 'ढूँढ रहा है', 'MOVE SET': 'चालें', '3 GESTURES': '३ इशारे', 'Lean': 'झुकें', 'Shift left or right': 'बाएँ या दाएँ जाएँ', 'Raise both hands': 'दोनों हाथ उठाएँ', 'Jump over a block': 'रुकावट के ऊपर कूदें', 'Crouch': 'नीचे झुकें', 'Duck under danger': 'रुकावट से बचने को झुकें', 'STEER': 'दिशा', 'JUMP': 'कूदें', 'DUCK': 'झुकें', 'LEAN LEFT': 'बाएँ झुकें', 'LEAN RIGHT': 'दाएँ झुकें', 'JUMP READY': 'कूदने को तैयार', 'DUCKING': 'झुक रहे हैं', 'TRACKING': 'ट्रैक हो रहा है', 'FINDING PLAYER': 'खिलाड़ी ढूँढ रहा है', 'KEYBOARD READY': 'कीबोर्ड तैयार',
    'CAMERA LINKED': 'कैमरा जुड़ा', 'LOCAL PLAY': 'स्थानीय खेल', 'Language': 'भाषा', 'Choose a mini game': 'छोटा खेल चुनें', 'Motion Arcade game': 'मोशन आर्केड खेल', 'mini game. Move your body to play.': 'छोटा खेल। खेलने के लिए शरीर हिलाएँ।', 'Close guide': 'सहायता बंद करें', 'Connect your camera to let the pose tracker read your movement. Your video is processed locally and is never uploaded.': 'आपकी गतिविधि पहचानने के लिए कैमरा जोड़ें। वीडियो आपके डिवाइस पर ही रहता है और कहीं अपलोड नहीं होता।', 'BUILT TO MOVE': 'चलने-फिरने का खेल', 'READY WHEN YOU ARE': 'तैयार हों तो शुरू करें', 'Movement guide': 'खेल सहायता', 'QUICK GUIDE': 'त्वरित सहायता', 'Play your way.': 'अपने तरीके से खेलें।', 'GOT IT': 'समझ गया', 'FINAL SCORE': 'अंतिम अंक', 'RUN COMPLETE': 'दौड़ पूरी', 'TIME IS UP': 'समय पूरा', 'READY TO COPY?': 'नकल के लिए तैयार?', 'READY TO CATCH?': 'पकड़ने के लिए तैयार?', 'STEP INTO THE TRACK': 'ट्रैक पर आएँ', 'RESET TO RUN IT BACK': 'फिर से शुरू करें', 'PRESS START WHEN YOU ARE READY': 'तैयार हों तो शुरू करें', 'TRACK ACTIVE': 'ट्रैक चालू', 'COPY THE MOVE': 'चाल की नकल करें', 'NEXT MOVE': 'अगली चाल', 'COPY THE DANCE STEP': 'डांस स्टेप करें', 'STEP LEFT': 'बाएँ जाएँ', 'STEP RIGHT': 'दाएँ जाएँ', 'HANDS UP': 'हाथ ऊपर', 'DROP LOW': 'नीचे झुकें', 'CAMERA PROCESSING STAYS IN YOUR BROWSER': 'कैमरा वीडियो आपके डिवाइस पर रहता है',
  },
  kn: {
    'BODY-POWERED PLAY': 'ದೇಹದಿಂದ ಆಟ', 'Move your body.': 'ದೇಹವನ್ನು ಚಲಿಸಿ.', 'Move the game.': 'ಆಟವನ್ನು ಚಲಿಸಿ.', 'No controller needed.': 'ಕಂಟ್ರೋಲರ್ ಅಗತ್ಯವಿಲ್ಲ.', 'Just step into frame and play.': 'ಕ್ಯಾಮೆರಾ ಮುಂದೆ ಬಂದು ಆಟವಾಡಿ.',
    'MINI GAMES': 'ಮಿನಿ ಆಟಗಳು', 'Dino Dance Run': 'ಡೈನೋ ಡ್ಯಾನ್ಸ್ ರನ್', 'Copy steps, dodge blocks': 'ಹೆಜ್ಜೆ ಅನುಕರಿಸಿ, ಅಡ್ಡಿಗಳನ್ನು ತಪ್ಪಿಸಿ', 'DANCE': 'ನೃತ್ಯ', 'Neon Runner': 'ನಿಯಾನ್ ರನ್ನರ್', 'Dodge, jump, duck': 'ತಪ್ಪಿಸಿ, ಜಿಗಿಯಿರಿ, ಬಾಗಿ', 'REFLEX': 'ಪ್ರತಿಕ್ರಿಯೆ', 'Star Catch': 'ನಕ್ಷತ್ರ ಹಿಡಿಯಿರಿ', 'Catch stars, avoid bombs': 'ನಕ್ಷತ್ರ ಹಿಡಿದು, ಬಾಂಬ್ ತಪ್ಪಿಸಿ', 'COLLECT': 'ಸಂಗ್ರಹ', 'Pose Match': 'ಭಂಗಿ ಹೊಂದಿಸಿ', 'Copy the pose prompt': 'ತೋರಿಸಿದ ಭಂಗಿ ಮಾಡಿ', 'QUICK REACT': 'ತ್ವರಿತ ಪ್ರತಿಕ್ರಿಯೆ',
    'DANCE SCORE': 'ನೃತ್ಯ ಅಂಕ', 'STARS CAUGHT': 'ಹಿಡಿದ ನಕ್ಷತ್ರ', 'MOVES MATCHED': 'ಹೊಂದಿದ ಹೆಜ್ಜೆ', 'YOUR SCORE': 'ನಿಮ್ಮ ಅಂಕ', 'IN PLAY': 'ಆಟ ನಡೆಯುತ್ತಿದೆ', 'STANDBY': 'ಸಿದ್ಧ', 'ROUND 01': 'ಸುತ್ತು ೦೧', 'SEC': 'ಸೆಕೆಂಡ್', 'YOUR MOVE': 'ನಿಮ್ಮ ಚಲನೆ', 'START RUN': 'ಓಟ ಆರಂಭಿಸಿ', 'END RUN': 'ಓಟ ನಿಲ್ಲಿಸಿ', 'PLAY AGAIN': 'ಮತ್ತೆ ಆಡಿ', 'MUSIC ON': 'ಸಂಗೀತ ಆನ್', 'MUSIC OFF': 'ಸಂಗೀತ ಆಫ್', 'Mute music': 'ಸಂಗೀತ ನಿಲ್ಲಿಸಿ', 'Enable music': 'ಸಂಗೀತ ಆನ್ ಮಾಡಿ',
    'Copy each dance step, dodge blocks, and run to the beat.': 'ಪ್ರತಿ ನೃತ್ಯ ಹೆಜ್ಜೆ ಮಾಡಿ, ಅಡ್ಡಿ ತಪ್ಪಿಸಿ, ತಾಳಕ್ಕೆ ಓಡಿ.', 'Dodge blocks. Raise your hands to jump; crouch to duck.': 'ಅಡ್ಡಿ ತಪ್ಪಿಸಿ. ಜಿಗಿಯಲು ಕೈ ಎತ್ತಿ; ಬಾಗಲು ಕುಳಿತುಕೊಳ್ಳಿ.', 'Move under the falling stars. Catch gold, avoid red bombs.': 'ಬೀಳುವ ನಕ್ಷತ್ರಗಳ ಕೆಳಗೆ ಹೋಗಿ. ಚಿನ್ನದ ನಕ್ಷತ್ರ ಹಿಡಿದು, ಕೆಂಪು ಬಾಂಬ್ ತಪ್ಪಿಸಿ.', 'Copy the prompt before it changes. Match each move for 100 points.': 'ಬದಲಾಗುವ ಮೊದಲು ಚಲನೆ ಮಾಡಿ. ಪ್ರತಿ ಸರಿಯಾದ ಚಲನೆಗೆ ೧೦೦ ಅಂಕ.',
    'PLAYER TRACKING': 'ಆಟಗಾರ ಟ್ರ್ಯಾಕಿಂಗ್', 'Step into frame': 'ಕ್ಯಾಮೆರಾ ಮುಂದೆ ಬನ್ನಿ', 'LIVE': 'ಚಾಲು', 'LOADING': 'ಲೋಡ್ ಆಗುತ್ತಿದೆ', 'ERROR': 'ದೋಷ', 'OFFLINE': 'ಆಫ್‌ಲೈನ್', 'Warming up the camera': 'ಕ್ಯಾಮೆರಾ ಸಿದ್ಧವಾಗುತ್ತಿದೆ', 'Could not connect': 'ಸಂಪರ್ಕ ಸಾಧ್ಯವಾಗಲಿಲ್ಲ', 'Camera is waiting': 'ಕ್ಯಾಮೆರಾ ಕಾಯುತ್ತಿದೆ', 'Full body in frame works best': 'ಪೂರ್ಣ ದೇಹವನ್ನು ಕ್ಯಾಮೆರಾದಲ್ಲಿ ತೋರಿಸಿ', 'Loading the pose model and asking permission': 'ಮಾದರಿ ಲೋಡ್ ಆಗುತ್ತಿದೆ, ಅನುಮತಿ ಕೇಳಲಾಗುತ್ತಿದೆ', 'CONNECT CAMERA': 'ಕ್ಯಾಮೆರಾ ಜೋಡಿಸಿ', 'CONNECTING...': 'ಜೋಡಿಸಲಾಗುತ್ತಿದೆ...', 'DISCONNECT CAMERA': 'ಕ್ಯಾಮೆರಾ ಬೇರ್ಪಡಿಸಿ', 'BODY POSITION': 'ದೇಹದ ಸ್ಥಾನ', 'POSE DETECTED': 'ಭಂಗಿ ಕಂಡುಬಂದಿದೆ', 'SEARCHING': 'ಹುಡುಕುತ್ತಿದೆ', 'MOVE SET': 'ಚಲನೆಗಳು', '3 GESTURES': '೩ ಚಲನೆಗಳು', 'Lean': 'ಬಾಗಿ', 'Shift left or right': 'ಎಡ ಅಥವಾ ಬಲಕ್ಕೆ ಸರಿಸಿ', 'Raise both hands': 'ಎರಡೂ ಕೈ ಎತ್ತಿ', 'Jump over a block': 'ಅಡ್ಡಿಯ ಮೇಲೆ ಜಿಗಿಯಿರಿ', 'Crouch': 'ಬಾಗಿ ಕುಳಿತುಕೊಳ್ಳಿ', 'Duck under danger': 'ಅಡ್ಡಿ ತಪ್ಪಿಸಲು ಬಾಗಿ', 'STEER': 'ದಿಕ್ಕು', 'JUMP': 'ಜಿಗಿ', 'DUCK': 'ಬಾಗಿ', 'LEAN LEFT': 'ಎಡಕ್ಕೆ ಬಾಗಿ', 'LEAN RIGHT': 'ಬಲಕ್ಕೆ ಬಾಗಿ', 'JUMP READY': 'ಜಿಗಿಯಲು ಸಿದ್ಧ', 'DUCKING': 'ಬಾಗುತ್ತಿದೆ', 'TRACKING': 'ಟ್ರ್ಯಾಕ್ ಆಗುತ್ತಿದೆ', 'FINDING PLAYER': 'ಆಟಗಾರನನ್ನು ಹುಡುಕುತ್ತಿದೆ', 'KEYBOARD READY': 'ಕೀಬೋರ್ಡ್ ಸಿದ್ಧ',
    'CAMERA LINKED': 'ಕ್ಯಾಮೆರಾ ಜೋಡಿಸಲಾಗಿದೆ', 'LOCAL PLAY': 'ಸ್ಥಳೀಯ ಆಟ', 'Language': 'ಭಾಷೆ', 'Choose a mini game': 'ಮಿನಿ ಆಟ ಆರಿಸಿ', 'Motion Arcade game': 'ಮೋಷನ್ ಆರ್ಕೇಡ್ ಆಟ', 'mini game. Move your body to play.': 'ಮಿನಿ ಆಟ. ಆಡಲು ದೇಹ ಚಲಿಸಿ.', 'Close guide': 'ಸಹಾಯ ಮುಚ್ಚಿ', 'Connect your camera to let the pose tracker read your movement. Your video is processed locally and is never uploaded.': 'ನಿಮ್ಮ ಚಲನೆಯನ್ನು ಗುರುತಿಸಲು ಕ್ಯಾಮೆರಾ ಜೋಡಿಸಿ. ವೀಡಿಯೊ ನಿಮ್ಮ ಸಾಧನದಲ್ಲೇ ಇರುತ್ತದೆ, ಅಪ್‌ಲೋಡ್ ಆಗುವುದಿಲ್ಲ.', 'BUILT TO MOVE': 'ಚಲನೆಯ ಆಟ', 'READY WHEN YOU ARE': 'ಸಿದ್ಧರಾದಾಗ ಆರಂಭಿಸಿ', 'Movement guide': 'ಆಟದ ಸಹಾಯ', 'QUICK GUIDE': 'ತ್ವರಿತ ಸಹಾಯ', 'Play your way.': 'ನಿಮ್ಮ ರೀತಿಯಲ್ಲಿ ಆಡಿ.', 'GOT IT': 'ಸರಿ', 'FINAL SCORE': 'ಅಂತಿಮ ಅಂಕ', 'RUN COMPLETE': 'ಓಟ ಮುಗಿದಿದೆ', 'TIME IS UP': 'ಸಮಯ ಮುಗಿದಿದೆ', 'READY TO COPY?': 'ಅನುಕರಿಸಲು ಸಿದ್ಧವೇ?', 'READY TO CATCH?': 'ಹಿಡಿಯಲು ಸಿದ್ಧವೇ?', 'STEP INTO THE TRACK': 'ಟ್ರ್ಯಾಕ್‌ಗೆ ಬನ್ನಿ', 'RESET TO RUN IT BACK': 'ಮತ್ತೆ ಆರಂಭಿಸಿ', 'PRESS START WHEN YOU ARE READY': 'ಸಿದ್ಧರಾದಾಗ ಆರಂಭಿಸಿ', 'TRACK ACTIVE': 'ಟ್ರ್ಯಾಕ್ ಚಾಲು', 'COPY THE MOVE': 'ಚಲನೆಯನ್ನು ಅನುಕರಿಸಿ', 'NEXT MOVE': 'ಮುಂದಿನ ಚಲನೆ', 'COPY THE DANCE STEP': 'ನೃತ್ಯದ ಹೆಜ್ಜೆ ಅನುಕರಿಸಿ', 'STEP LEFT': 'ಎಡಕ್ಕೆ ಹೆಜ್ಜೆ', 'STEP RIGHT': 'ಬಲಕ್ಕೆ ಹೆಜ್ಜೆ', 'HANDS UP': 'ಕೈ ಮೇಲೆ', 'DROP LOW': 'ಕೆಳಗೆ ಬಾಗಿ', 'CAMERA PROCESSING STAYS IN YOUR BROWSER': 'ಕ್ಯಾಮೆರಾ ವೀಡಿಯೊ ನಿಮ್ಮ ಸಾಧನದಲ್ಲೇ ಇರುತ್ತದೆ',
  },
  te: {
    'BODY-POWERED PLAY': 'శరీరంతో ఆట', 'Move your body.': 'మీ శరీరాన్ని కదపండి.', 'Move the game.': 'ఆటను కదపండి.', 'No controller needed.': 'కంట్రోలర్ అవసరం లేదు.', 'Just step into frame and play.': 'కెమెరా ముందు నిలబడి ఆడండి.',
    'MINI GAMES': 'చిన్న ఆటలు', 'Dino Dance Run': 'డైనో డాన్స్ రన్', 'Copy steps, dodge blocks': 'స్టెప్పులు చేయండి, అడ్డంకులు తప్పించండి', 'DANCE': 'డాన్స్', 'Neon Runner': 'నియాన్ రన్నర్', 'Dodge, jump, duck': 'తప్పించండి, దూకండి, వంగండి', 'REFLEX': 'వేగం', 'Star Catch': 'నక్షత్రాలు పట్టండి', 'Catch stars, avoid bombs': 'నక్షత్రాలు పట్టండి, బాంబులను తప్పించండి', 'COLLECT': 'సేకరణ', 'Pose Match': 'భంగిమ సరిపోల్చండి', 'Copy the pose prompt': 'చూపిన భంగిమ చేయండి', 'QUICK REACT': 'వేగంగా స్పందించండి',
    'DANCE SCORE': 'డాన్స్ స్కోరు', 'STARS CAUGHT': 'పట్టిన నక్షత్రాలు', 'MOVES MATCHED': 'సరిపోలిన స్టెప్పులు', 'YOUR SCORE': 'మీ స్కోరు', 'IN PLAY': 'ఆటలో ఉంది', 'STANDBY': 'సిద్ధం', 'ROUND 01': 'రౌండ్ ౦౧', 'SEC': 'సెకన్లు', 'YOUR MOVE': 'మీ కదలిక', 'START RUN': 'పరుగును ప్రారంభించండి', 'END RUN': 'పరుగును ఆపండి', 'PLAY AGAIN': 'మళ్లీ ఆడండి', 'MUSIC ON': 'సంగీతం ఆన్', 'MUSIC OFF': 'సంగీతం ఆఫ్', 'Mute music': 'సంగీతాన్ని ఆపండి', 'Enable music': 'సంగీతాన్ని ఆన్ చేయండి',
    'Copy each dance step, dodge blocks, and run to the beat.': 'ప్రతి డాన్స్ స్టెప్ చేయండి, అడ్డంకులు తప్పించండి, సంగీత తాళానికి పరుగెత్తండి.', 'Dodge blocks. Raise your hands to jump; crouch to duck.': 'అడ్డంకులు తప్పించండి. దూకడానికి చేతులు ఎత్తండి; వంగడానికి కూర్చోండి.', 'Move under the falling stars. Catch gold, avoid red bombs.': 'పడే నక్షత్రాల కిందకు వెళ్లండి. బంగారు నక్షత్రాలు పట్టండి, ఎరుపు బాంబులు తప్పించండి.', 'Copy the prompt before it changes. Match each move for 100 points.': 'మారేలోపు కదలికను చేయండి. ప్రతి సరైన కదలికకు ౧౦౦ పాయింట్లు.',
    'PLAYER TRACKING': 'ఆటగాడి ట్రాకింగ్', 'Step into frame': 'కెమెరా ముందు నిలబడండి', 'LIVE': 'ప్రత్యక్షం', 'LOADING': 'లోడ్ అవుతోంది', 'ERROR': 'లోపం', 'OFFLINE': 'ఆఫ్‌లైన్', 'Warming up the camera': 'కెమెరా సిద్ధమవుతోంది', 'Could not connect': 'కనెక్ట్ కాలేదు', 'Camera is waiting': 'కెమెరా సిద్ధంగా ఉంది', 'Full body in frame works best': 'మీ పూర్తి శరీరం కెమెరాలో కనిపించాలి', 'Loading the pose model and asking permission': 'మోడల్ లోడ్ అవుతోంది, అనుమతి అడుగుతోంది', 'CONNECT CAMERA': 'కెమెరాను కనెక్ట్ చేయండి', 'CONNECTING...': 'కనెక్ట్ అవుతోంది...', 'DISCONNECT CAMERA': 'కెమెరాను డిస్‌కనెక్ట్ చేయండి', 'BODY POSITION': 'శరీర స్థానం', 'POSE DETECTED': 'భంగిమ గుర్తించబడింది', 'SEARCHING': 'వెతుకుతోంది', 'MOVE SET': 'కదలికలు', '3 GESTURES': '౩ సంకేతాలు', 'Lean': 'వంగండి', 'Shift left or right': 'ఎడమ లేదా కుడికి కదలండి', 'Raise both hands': 'రెండు చేతులు ఎత్తండి', 'Jump over a block': 'అడ్డంకిపైకి దూకండి', 'Crouch': 'వంగి కూర్చోండి', 'Duck under danger': 'అడ్డంకి కింద వంగండి', 'STEER': 'దిశ', 'JUMP': 'దూకండి', 'DUCK': 'వంగండి', 'LEAN LEFT': 'ఎడమకు వంగండి', 'LEAN RIGHT': 'కుడికి వంగండి', 'JUMP READY': 'దూకడానికి సిద్ధం', 'DUCKING': 'వంగుతోంది', 'TRACKING': 'ట్రాక్ అవుతోంది', 'FINDING PLAYER': 'ఆటగాడిని వెతుకుతోంది', 'KEYBOARD READY': 'కీబోర్డ్ సిద్ధం',
    'CAMERA LINKED': 'కెమెరా కనెక్ట్ అయింది', 'LOCAL PLAY': 'స్థానిక ఆట', 'Language': 'భాష', 'Choose a mini game': 'చిన్న ఆటను ఎంచుకోండి', 'Motion Arcade game': 'మోషన్ ఆర్కేడ్ ఆట', 'mini game. Move your body to play.': 'చిన్న ఆట. ఆడటానికి శరీరాన్ని కదపండి.', 'Close guide': 'సహాయాన్ని మూసివేయండి', 'Connect your camera to let the pose tracker read your movement. Your video is processed locally and is never uploaded.': 'మీ కదలికలను గుర్తించడానికి కెమెరాను కనెక్ట్ చేయండి. వీడియో మీ పరికరంలోనే ఉంటుంది, ఎక్కడికీ పంపబడదు.', 'BUILT TO MOVE': 'కదలికల ఆట', 'READY WHEN YOU ARE': 'సిద్ధమైనప్పుడు ప్రారంభించండి', 'Movement guide': 'ఆట సహాయం', 'QUICK GUIDE': 'త్వరిత సహాయం', 'Play your way.': 'మీకు నచ్చినట్లు ఆడండి.', 'GOT IT': 'సరే', 'FINAL SCORE': 'చివరి స్కోరు', 'RUN COMPLETE': 'పరుగు పూర్తయింది', 'TIME IS UP': 'సమయం ముగిసింది', 'READY TO COPY?': 'అనుకరించడానికి సిద్ధమా?', 'READY TO CATCH?': 'పట్టుకోవడానికి సిద్ధమా?', 'STEP INTO THE TRACK': 'ట్రాక్‌లోకి రండి', 'RESET TO RUN IT BACK': 'మళ్లీ ప్రారంభించండి', 'PRESS START WHEN YOU ARE READY': 'సిద్ధమైనప్పుడు ప్రారంభించండి', 'TRACK ACTIVE': 'ట్రాక్ నడుస్తోంది', 'COPY THE MOVE': 'కదలికను అనుకరించండి', 'NEXT MOVE': 'తర్వాతి కదలిక', 'COPY THE DANCE STEP': 'డాన్స్ స్టెప్ చేయండి', 'STEP LEFT': 'ఎడమకు అడుగు', 'STEP RIGHT': 'కుడికి అడుగు', 'HANDS UP': 'చేతులు పైకి', 'DROP LOW': 'కిందకు వంగండి', 'CAMERA PROCESSING STAYS IN YOUR BROWSER': 'కెమెరా వీడియో మీ పరికరంలోనే ఉంటుంది',
  },
  ta: {
    'BODY-POWERED PLAY': 'உடல் அசைவால் விளையாடுங்கள்', 'Move your body.': 'உடலை அசையுங்கள்.', 'Move the game.': 'விளையாட்டை நகர்த்துங்கள்.', 'No controller needed.': 'கண்ட்ரோலர் தேவையில்லை.', 'Just step into frame and play.': 'கேமரா முன் வந்து விளையாடுங்கள்.',
    'MINI GAMES': 'சிறு விளையாட்டுகள்', 'Dino Dance Run': 'டைனோ டான்ஸ் ஓட்டம்', 'Copy steps, dodge blocks': 'அசைவுகளைச் செய்து தடைகளைத் தவிர்க்கவும்', 'DANCE': 'நடனம்', 'Neon Runner': 'நியான் ஓட்டம்', 'Dodge, jump, duck': 'தவிர்க்கவும், குதிக்கவும், குனியவும்', 'REFLEX': 'விரைவு', 'Star Catch': 'நட்சத்திரம் பிடி', 'Catch stars, avoid bombs': 'நட்சத்திரங்களைப் பிடித்து குண்டுகளைத் தவிர்க்கவும்', 'COLLECT': 'சேகரிப்பு', 'Pose Match': 'அசைவைப் பொருத்து', 'Copy the pose prompt': 'காட்டும் அசைவைச் செய்யவும்', 'QUICK REACT': 'விரைவு செயல்',
    'DANCE SCORE': 'நடன மதிப்பெண்', 'STARS CAUGHT': 'பிடித்த நட்சத்திரங்கள்', 'MOVES MATCHED': 'பொருந்திய அசைவுகள்', 'YOUR SCORE': 'உங்கள் மதிப்பெண்', 'IN PLAY': 'விளையாடுகிறது', 'STANDBY': 'தயார்', 'ROUND 01': 'சுற்று ௦௧', 'SEC': 'நொடி', 'YOUR MOVE': 'உங்கள் அசைவு', 'START RUN': 'ஓட்டத்தைத் தொடங்கு', 'END RUN': 'ஓட்டத்தை நிறுத்து', 'PLAY AGAIN': 'மீண்டும் விளையாடு', 'MUSIC ON': 'இசை இயக்கு', 'MUSIC OFF': 'இசை நிறுத்து', 'Mute music': 'இசையை நிறுத்து', 'Enable music': 'இசையை இயக்கு',
    'Copy each dance step, dodge blocks, and run to the beat.': 'ஒவ்வொரு நடன அசைவையும் செய்து தடைகளைத் தவிர்த்து இசைக்கேற்ப ஓடுங்கள்.', 'Dodge blocks. Raise your hands to jump; crouch to duck.': 'தடைகளைத் தவிர்க்கவும். குதிக்க கைகளை உயர்த்தவும்; குனிய கீழே அமரவும்.', 'Move under the falling stars. Catch gold, avoid red bombs.': 'விழும் நட்சத்திரங்களின் கீழே செல்லுங்கள். தங்க நட்சத்திரங்களைப் பிடித்து சிவப்பு குண்டுகளைத் தவிர்க்கவும்.', 'Copy the prompt before it changes. Match each move for 100 points.': 'அடுத்த அசைவு வரும்முன் இதைச் செய்யுங்கள். சரியான அசைவுக்கு ௧௦௦ மதிப்பெண்கள்.',
    'PLAYER TRACKING': 'வீரர் கண்காணிப்பு', 'Step into frame': 'கேமரா முன் வாருங்கள்', 'LIVE': 'இயக்கம்', 'LOADING': 'ஏற்றுகிறது', 'ERROR': 'பிழை', 'OFFLINE': 'முடக்கம்', 'Warming up the camera': 'கேமரா தயாராகிறது', 'Could not connect': 'இணைக்க முடியவில்லை', 'Camera is waiting': 'கேமரா காத்திருக்கிறது', 'Full body in frame works best': 'முழு உடலும் கேமராவில் தெரியட்டும்', 'Loading the pose model and asking permission': 'அசைவு மாதிரி ஏற்றப்படுகிறது; அனுமதி கேட்கப்படுகிறது', 'CONNECT CAMERA': 'கேமராவை இணை', 'CONNECTING...': 'இணைக்கிறது...', 'DISCONNECT CAMERA': 'கேமராவைத் துண்டி', 'BODY POSITION': 'உடல் நிலை', 'POSE DETECTED': 'அசைவு கண்டறியப்பட்டது', 'SEARCHING': 'தேடுகிறது', 'MOVE SET': 'அசைவுகள்', '3 GESTURES': '௩ சைகைகள்', 'Lean': 'சாயுங்கள்', 'Shift left or right': 'இடது அல்லது வலது செல்லுங்கள்', 'Raise both hands': 'இரு கைகளையும் உயர்த்துங்கள்', 'Jump over a block': 'தடையைத் தாண்டிக் குதிக்கவும்', 'Crouch': 'குனியுங்கள்', 'Duck under danger': 'தடைக்குக் கீழே குனியுங்கள்', 'STEER': 'திசை', 'JUMP': 'குதி', 'DUCK': 'குனி', 'LEAN LEFT': 'இடப்புறம் சாய்', 'LEAN RIGHT': 'வலப்புறம் சாய்', 'JUMP READY': 'குதிக்கத் தயார்', 'DUCKING': 'குனிகிறது', 'TRACKING': 'கண்காணிக்கிறது', 'FINDING PLAYER': 'வீரரைத் தேடுகிறது', 'KEYBOARD READY': 'விசைப்பலகை தயார்',
    'CAMERA LINKED': 'கேமரா இணைந்தது', 'LOCAL PLAY': 'உள்ளூர் விளையாட்டு', 'Language': 'மொழி', 'Choose a mini game': 'சிறு விளையாட்டைத் தேர்வு செய்க', 'Motion Arcade game': 'மோஷன் ஆர்கேட் விளையாட்டு', 'mini game. Move your body to play.': 'சிறு விளையாட்டு. விளையாட உடலை அசையுங்கள்.', 'Close guide': 'உதவியை மூடு', 'Connect your camera to let the pose tracker read your movement. Your video is processed locally and is never uploaded.': 'உங்கள் அசைவைக் கண்டறிய கேமராவை இணைக்கவும். காணொளி உங்கள் சாதனத்திலேயே இருக்கும்; பதிவேற்றப்படாது.', 'BUILT TO MOVE': 'அசைவு விளையாட்டு', 'READY WHEN YOU ARE': 'தயாரானதும் தொடங்குங்கள்', 'Movement guide': 'விளையாட்டு உதவி', 'QUICK GUIDE': 'விரைவு உதவி', 'Play your way.': 'உங்கள் விருப்பப்படி விளையாடுங்கள்.', 'GOT IT': 'சரி', 'FINAL SCORE': 'இறுதி மதிப்பெண்', 'RUN COMPLETE': 'ஓட்டம் முடிந்தது', 'TIME IS UP': 'நேரம் முடிந்தது', 'READY TO COPY?': 'அசைக்குத் தயாரா?', 'READY TO CATCH?': 'பிடிக்கத் தயாரா?', 'STEP INTO THE TRACK': 'தடத்தில் வாருங்கள்', 'RESET TO RUN IT BACK': 'மீண்டும் தொடங்குங்கள்', 'PRESS START WHEN YOU ARE READY': 'தயாரானதும் தொடங்குங்கள்', 'TRACK ACTIVE': 'ஓட்டம் நடக்கிறது', 'COPY THE MOVE': 'அசைவைச் செய்யுங்கள்', 'NEXT MOVE': 'அடுத்த அசைவு', 'COPY THE DANCE STEP': 'நடன அசைவைச் செய்யுங்கள்', 'STEP LEFT': 'இடப்புறம் செல்லுங்கள்', 'STEP RIGHT': 'வலப்புறம் செல்லுங்கள்', 'HANDS UP': 'கைகளை உயர்த்துங்கள்', 'DROP LOW': 'கீழே குனியுங்கள்', 'CAMERA PROCESSING STAYS IN YOUR BROWSER': 'கேமரா வீடியோ உங்கள் சாதனத்திலேயே இருக்கும்',
  },
  ml: {
    'BODY-POWERED PLAY': 'ശരീരം ചലിപ്പിച്ച് കളിക്കൂ', 'Move your body.': 'ശരീരം ചലിപ്പിക്കൂ.', 'Move the game.': 'ഗെയിം നീക്കൂ.', 'No controller needed.': 'കൺട്രോളർ വേണ്ട.', 'Just step into frame and play.': 'ക്യാമറയ്ക്ക് മുന്നിൽ വന്ന് കളിക്കൂ.',
    'MINI GAMES': 'ചെറിയ ഗെയിമുകൾ', 'Dino Dance Run': 'ഡൈനോ ഡാൻസ് ഓട്ടം', 'Copy steps, dodge blocks': 'ചുവടുകൾ അനുകരിച്ച് തടസ്സങ്ങൾ ഒഴിവാക്കൂ', 'DANCE': 'നൃത്തം', 'Neon Runner': 'നിയോൺ ഓട്ടം', 'Dodge, jump, duck': 'ഒഴിവാക്കൂ, ചാടൂ, കുനിയൂ', 'REFLEX': 'വേഗപ്രതികരണം', 'Star Catch': 'നക്ഷത്രം പിടിക്കൂ', 'Catch stars, avoid bombs': 'നക്ഷത്രങ്ങൾ പിടിച്ച് ബോംബുകൾ ഒഴിവാക്കൂ', 'COLLECT': 'ശേഖരണം', 'Pose Match': 'ചലനം അനുകരിക്കൂ', 'Copy the pose prompt': 'കാണിക്കുന്ന ചലനം ചെയ്യൂ', 'QUICK REACT': 'വേഗത്തിൽ ചെയ്യൂ',
    'DANCE SCORE': 'നൃത്ത പോയിന്റ്', 'STARS CAUGHT': 'പിടിച്ച നക്ഷത്രങ്ങൾ', 'MOVES MATCHED': 'ചേരുന്ന ചലനങ്ങൾ', 'YOUR SCORE': 'നിങ്ങളുടെ പോയിന്റ്', 'IN PLAY': 'കളിക്കുന്നു', 'STANDBY': 'തയ്യാർ', 'ROUND 01': 'റൗണ്ട് ൦൧', 'SEC': 'സെക്കൻഡ്', 'YOUR MOVE': 'നിങ്ങളുടെ നീക്കം', 'START RUN': 'ഓട്ടം തുടങ്ങൂ', 'END RUN': 'ഓട്ടം നിർത്തൂ', 'PLAY AGAIN': 'വീണ്ടും കളിക്കൂ', 'MUSIC ON': 'സംഗീതം ഓൺ', 'MUSIC OFF': 'സംഗീതം ഓഫ്', 'Mute music': 'സംഗീതം നിർത്തൂ', 'Enable music': 'സംഗീതം ഓണാക്കൂ',
    'Copy each dance step, dodge blocks, and run to the beat.': 'ഓരോ നൃത്തച്ചുവടും അനുകരിച്ച് തടസ്സങ്ങൾ ഒഴിവാക്കി താളത്തിനൊപ്പം ഓടൂ.', 'Dodge blocks. Raise your hands to jump; crouch to duck.': 'തടസ്സങ്ങൾ ഒഴിവാക്കൂ. ചാടാൻ കൈകൾ ഉയർത്തൂ; കുനിയാൻ താഴെയിരിക്കൂ.', 'Move under the falling stars. Catch gold, avoid red bombs.': 'വീഴുന്ന നക്ഷത്രങ്ങൾക്കടിയിലേക്ക് നീങ്ങൂ. സ്വർണ്ണ നക്ഷത്രങ്ങൾ പിടിച്ച് ചുവന്ന ബോംബുകൾ ഒഴിവാക്കൂ.', 'Copy the prompt before it changes. Match each move for 100 points.': 'അടുത്തത് വരുംമുമ്പ് ഈ ചലനം ചെയ്യൂ. ശരിയായ ഓരോ നീക്കത്തിനും ൧൦൦ പോയിന്റ്.',
    'PLAYER TRACKING': 'കളിക്കാരനെ പിന്തുടരുന്നു', 'Step into frame': 'ക്യാമറയ്ക്ക് മുന്നിൽ വരൂ', 'LIVE': 'സജീവം', 'LOADING': 'ലോഡ് ചെയ്യുന്നു', 'ERROR': 'പിശക്', 'OFFLINE': 'ഓഫ്‌ലൈൻ', 'Warming up the camera': 'ക്യാമറ തയ്യാറാകുന്നു', 'Could not connect': 'ബന്ധിപ്പിക്കാനായില്ല', 'Camera is waiting': 'ക്യാമറ കാത്തിരിക്കുന്നു', 'Full body in frame works best': 'മുഴുവൻ ശരീരവും ക്യാമറയിൽ കാണിക്കൂ', 'Loading the pose model and asking permission': 'ചലന മോഡൽ ലോഡ് ചെയ്യുന്നു; അനുമതി ചോദിക്കുന്നു', 'CONNECT CAMERA': 'ക്യാമറ ബന്ധിപ്പിക്കൂ', 'CONNECTING...': 'ബന്ധിപ്പിക്കുന്നു...', 'DISCONNECT CAMERA': 'ക്യാമറ വിച്ഛേദിക്കൂ', 'BODY POSITION': 'ശരീരത്തിന്റെ സ്ഥാനം', 'POSE DETECTED': 'ചലനം കണ്ടെത്തി', 'SEARCHING': 'തിരയുന്നു', 'MOVE SET': 'ചലനങ്ങൾ', '3 GESTURES': '൩ ആംഗ്യങ്ങൾ', 'Lean': 'ചായൂ', 'Shift left or right': 'ഇടത്തോട്ടോ വലത്തോട്ടോ നീങ്ങൂ', 'Raise both hands': 'രണ്ട് കൈകളും ഉയർത്തൂ', 'Jump over a block': 'തടസ്സത്തിന് മുകളിലൂടെ ചാടൂ', 'Crouch': 'കുനിയൂ', 'Duck under danger': 'തടസ്സത്തിന് താഴെ കുനിയൂ', 'STEER': 'ദിശ', 'JUMP': 'ചാടൂ', 'DUCK': 'കുനിയൂ', 'LEAN LEFT': 'ഇടത്തോട്ട് ചായൂ', 'LEAN RIGHT': 'വലത്തോട്ട് ചായൂ', 'JUMP READY': 'ചാടാൻ തയ്യാറാണ്', 'DUCKING': 'കുനിയുന്നു', 'TRACKING': 'പിന്തുടരുന്നു', 'FINDING PLAYER': 'കളിക്കാരനെ തിരയുന്നു', 'KEYBOARD READY': 'കീബോർഡ് തയ്യാർ',
    'CAMERA LINKED': 'ക്യാമറ ബന്ധിപ്പിച്ചു', 'LOCAL PLAY': 'ലോക്കൽ ഗെയിം', 'Language': 'ഭാഷ', 'Choose a mini game': 'ചെറിയ ഗെയിം തിരഞ്ഞെടുക്കൂ', 'Motion Arcade game': 'മോഷൻ ആർക്കേഡ് ഗെയിം', 'mini game. Move your body to play.': 'ചെറിയ ഗെയിം. കളിക്കാൻ ശരീരം ചലിപ്പിക്കൂ.', 'Close guide': 'സഹായം അടയ്ക്കൂ', 'Connect your camera to let the pose tracker read your movement. Your video is processed locally and is never uploaded.': 'നിങ്ങളുടെ ചലനം തിരിച്ചറിയാൻ ക്യാമറ ബന്ധിപ്പിക്കൂ. വീഡിയോ നിങ്ങളുടെ ഉപകരണത്തിൽ തന്നെ തുടരും; അപ്‌ലോഡ് ചെയ്യില്ല.', 'BUILT TO MOVE': 'ചലന ഗെയിം', 'READY WHEN YOU ARE': 'തയ്യാറാകുമ്പോൾ തുടങ്ങൂ', 'Movement guide': 'ഗെയിം സഹായം', 'QUICK GUIDE': 'വേഗസഹായം', 'Play your way.': 'നിങ്ങളുടെ രീതിയിൽ കളിക്കൂ.', 'GOT IT': 'ശരി', 'FINAL SCORE': 'അവസാന പോയിന്റ്', 'RUN COMPLETE': 'ഓട്ടം പൂർത്തിയായി', 'TIME IS UP': 'സമയം തീർന്നു', 'READY TO COPY?': 'അനുകരിക്കാൻ തയ്യാറാണോ?', 'READY TO CATCH?': 'പിടിക്കാൻ തയ്യാറാണോ?', 'STEP INTO THE TRACK': 'ട്രാക്കിലേക്ക് വരൂ', 'RESET TO RUN IT BACK': 'വീണ്ടും തുടങ്ങൂ', 'PRESS START WHEN YOU ARE READY': 'തയ്യാറാകുമ്പോൾ തുടങ്ങൂ', 'TRACK ACTIVE': 'ഓട്ടം തുടരുന്നു', 'COPY THE MOVE': 'ചലനം അനുകരിക്കൂ', 'NEXT MOVE': 'അടുത്ത ചലനം', 'COPY THE DANCE STEP': 'നൃത്തച്ചുവട് അനുകരിക്കൂ', 'STEP LEFT': 'ഇടത്തോട്ട് നീങ്ങൂ', 'STEP RIGHT': 'വലത്തോട്ട് നീങ്ങൂ', 'HANDS UP': 'കൈകൾ ഉയർത്തൂ', 'DROP LOW': 'താഴെ കുനിയൂ', 'CAMERA PROCESSING STAYS IN YOUR BROWSER': 'ക്യാമറ വീഡിയോ നിങ്ങളുടെ ഉപകരണത്തിൽ തന്നെ',
  },
}

function t(language: Language, phrase: string) {
  return language === 'en' ? phrase : TRANSLATIONS[language][phrase] ?? phrase
}

const GAMES: { id: GameMode; name: string; detail: string; icon: typeof Gamepad2; label: string }[] = [
  { id: 'dance', name: 'Dino Dance Run', detail: 'Copy steps, dodge blocks', icon: Music2, label: 'DANCE' },
  { id: 'runner', name: 'Neon Runner', detail: 'Dodge, jump, duck', icon: Gamepad2, label: 'REFLEX' },
  { id: 'catcher', name: 'Star Catch', detail: 'Catch stars, avoid bombs', icon: Star, label: 'COLLECT' },
  { id: 'pose', name: 'Pose Match', detail: 'Copy the pose prompt', icon: Zap, label: 'QUICK REACT' },
  { id: 'storm', name: 'Sky Sweep', detail: 'Dodge beams, grab orbs', icon: Sparkles, label: 'SURVIVE' },
]
const CHALLENGES: ChallengeAction[] = ['left', 'right', 'jump', 'duck']
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function createRuntime(mode: GameMode, now: number): Runtime {
  return { mode, x: 480, jumpY: 0, jumpVelocity: 0, obstacles: [], lastSpawn: now, lastTime: now, score: 0, jumpWasDown: false, crashed: false, secondsLeft: 30, challenge: 'left', nextChallengeAt: now + 1100 }
}

function matchesChallenge(challenge: ChallengeAction, control: PoseControl) {
  if (challenge === 'left') return control.lean < -0.5
  if (challenge === 'right') return control.lean > 0.5
  if (challenge === 'jump') return control.jump
  return control.crouch
}

function challengeLabel(challenge: ChallengeAction, language: Language) {
  return t(language, { left: 'STEP LEFT', right: 'STEP RIGHT', jump: 'HANDS UP', duck: 'DROP LOW' }[challenge])
}

function stopArcadeMusic(musicRef: React.MutableRefObject<ArcadeMusic | null>) {
  const music = musicRef.current
  if (!music) return
  window.clearInterval(music.timer)
  musicRef.current = null
  const now = music.context.currentTime
  music.master.gain.cancelScheduledValues(now)
  music.master.gain.setValueAtTime(Math.max(music.master.gain.value, 0.0001), now)
  music.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)
  window.setTimeout(() => void music.context.close(), 180)
}

function startArcadeMusic(musicRef: React.MutableRefObject<ArcadeMusic | null>, style: MusicStyle) {
  if (musicRef.current?.style === style) return
  if (musicRef.current) stopArcadeMusic(musicRef)
  const context = new AudioContext()
  const master = context.createGain()
  master.gain.value = 0.14
  master.connect(context.destination)
  const noise = context.createBuffer(1, context.sampleRate, context.sampleRate)
  const data = noise.getChannelData(0)
  for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1
  const music: ArcadeMusic = { context, master, noise, timer: 0, nextStep: context.currentTime + 0.05, step: 0, style }
  musicRef.current = music

  const playTone = (frequency: number, at: number, duration: number, wave: OscillatorType, volume: number) => {
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    oscillator.type = wave
    oscillator.frequency.setValueAtTime(frequency, at)
    envelope.gain.setValueAtTime(0.0001, at)
    envelope.gain.exponentialRampToValueAtTime(volume, at + 0.012)
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration)
    oscillator.connect(envelope)
    envelope.connect(master)
    oscillator.start(at)
    oscillator.stop(at + duration + 0.02)
  }

  const playKick = (at: number) => {
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(145, at)
    oscillator.frequency.exponentialRampToValueAtTime(48, at + 0.12)
    envelope.gain.setValueAtTime(0.3, at)
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.16)
    oscillator.connect(envelope)
    envelope.connect(master)
    oscillator.start(at)
    oscillator.stop(at + 0.18)
  }

  const playNoise = (at: number, duration: number, volume: number, cutoff: number) => {
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const envelope = context.createGain()
    source.buffer = noise
    filter.type = 'highpass'
    filter.frequency.value = cutoff
    envelope.gain.setValueAtTime(volume, at)
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration)
    source.connect(filter)
    filter.connect(envelope)
    envelope.connect(master)
    source.start(at)
    source.stop(at + duration)
  }

  const patterns: Record<MusicStyle, { notes: number[]; bass: number[]; stepSeconds: number; lead: OscillatorType }> = {
    arcade: { notes: [659, 784, 988, 784, 587, 740, 880, 740, 523, 659, 784, 659, 587, 740, 880, 740], bass: [110, 110, 98, 123], stepSeconds: 0.25, lead: 'square' },
    chiptune: { notes: [523, 659, 784, 1047, 784, 659, 587, 784, 698, 880, 1047, 880, 659, 784, 988, 784], bass: [131, 131, 110, 147], stepSeconds: 0.18, lead: 'square' },
    synthwave: { notes: [440, 523, 659, 784, 659, 523, 392, 523, 349, 440, 523, 659, 523, 440, 330, 440], bass: [55, 55, 65, 49], stepSeconds: 0.25, lead: 'sawtooth' },
    drumBass: { notes: [587, 0, 784, 659, 880, 0, 784, 523, 659, 0, 880, 784, 988, 0, 880, 659], bass: [73, 73, 82, 65], stepSeconds: 0.14, lead: 'triangle' },
  }
  const pattern = patterns[style]
  const schedule = () => {
    while (music.nextStep < context.currentTime + 0.12) {
      const beat = music.step % 16
      const at = music.nextStep
      if (beat % 4 === 0) playKick(at)
      if (style === 'drumBass' ? beat % 4 === 2 : beat === 4 || beat === 12) playNoise(at, style === 'drumBass' ? 0.08 : 0.12, 0.1, 900)
      if (beat % 2 === 1) playNoise(at, 0.035, style === 'drumBass' ? 0.045 : 0.035, 6500)
      if (pattern.notes[beat]) playTone(pattern.notes[beat], at, pattern.stepSeconds * 0.72, pattern.lead, style === 'synthwave' ? 0.018 : 0.027)
      if (beat % 4 === 0) playTone(pattern.bass[Math.floor(beat / 4)], at, 0.22, style === 'synthwave' ? 'sawtooth' : 'triangle', style === 'synthwave' ? 0.055 : 0.08)
      music.step += 1
      music.nextStep += pattern.stepSeconds
    }
  }

  void context.resume()
  schedule()
  music.timer = window.setInterval(schedule, 25)
}

function playGameSound(musicRef: React.MutableRefObject<ArcadeMusic | null>, sound: 'jump' | 'collect' | 'match' | 'hit') {
  const music = musicRef.current
  if (!music || music.context.state !== 'running') return
  const { context, master } = music
  const at = context.currentTime
  const tones = sound === 'jump' ? [240, 520] : sound === 'collect' ? [660, 990] : sound === 'match' ? [523, 659, 784] : [180, 65]
  tones.forEach((frequency, index) => {
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    const startAt = at + index * (sound === 'match' ? 0.07 : 0.045)
    oscillator.type = sound === 'hit' ? 'sawtooth' : sound === 'collect' ? 'sine' : 'triangle'
    oscillator.frequency.setValueAtTime(frequency, startAt)
    if (sound === 'jump' || sound === 'hit') oscillator.frequency.exponentialRampToValueAtTime(sound === 'jump' ? frequency * 1.7 : frequency * 0.55, startAt + 0.13)
    envelope.gain.setValueAtTime(0.0001, startAt)
    envelope.gain.exponentialRampToValueAtTime(sound === 'hit' ? 0.13 : 0.09, startAt + 0.008)
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + (sound === 'hit' ? 0.2 : 0.11))
    oscillator.connect(envelope)
    envelope.connect(master)
    oscillator.start(startAt)
    oscillator.stop(startAt + (sound === 'hit' ? 0.22 : 0.13))
  })
}

function getAngle(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark) {
  const first = Math.atan2(a.y - b.y, a.x - b.x)
  const second = Math.atan2(c.y - b.y, c.x - b.x)
  return Math.abs(((second - first + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * (180 / Math.PI)
}

function drawGame(context: CanvasRenderingContext2D, runtime: Runtime, control: PoseControl, playing: boolean, language: Language) {
  const width = 960
  const height = 540
  context.clearRect(0, 0, width, height)
  const sky = context.createLinearGradient(0, 0, 0, height)
  sky.addColorStop(0, '#111918')
  sky.addColorStop(1, '#1b2924')
  context.fillStyle = sky
  context.fillRect(0, 0, width, height)

  context.strokeStyle = 'rgba(169, 213, 153, 0.09)'
  context.lineWidth = 1
  for (let x = 0; x <= width; x += 48) {
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, height)
    context.stroke()
  }
  for (let y = 20; y < height; y += 48) {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(width, y)
    context.stroke()
  }

  context.fillStyle = '#27372f'
  for (let index = 0; index < 16; index += 1) {
    const buildingWidth = 28 + (index % 4) * 12
    const buildingHeight = 45 + ((index * 37) % 96)
    context.fillRect(index * 64 - 8, 410 - buildingHeight, buildingWidth, buildingHeight)
  }
  context.fillStyle = '#a9d599'
  context.globalAlpha = 0.6
  for (let index = 0; index < 34; index += 1) {
    const starX = (index * 137) % width
    const starY = 38 + ((index * 71) % 285)
    context.fillRect(starX, starY, 2, 2)
  }
  context.globalAlpha = 1

  const floorY = 458
  context.fillStyle = '#34473a'
  context.fillRect(0, floorY, width, height - floorY)
  context.fillStyle = '#c4f06f'
  context.fillRect(0, floorY, width, 4)
  context.strokeStyle = 'rgba(196, 240, 111, 0.25)'
  for (let x = -40; x < width; x += 80) {
    context.beginPath()
    context.moveTo(x, floorY + 35)
    context.lineTo(x + 42, height)
    context.stroke()
  }

  for (const obstacle of runtime.obstacles) {
    context.save()
    context.shadowColor = `hsl(${obstacle.hue} 88% 62%)`
    context.shadowBlur = 22
    context.fillStyle = `hsl(${obstacle.hue} 76% 58%)`
    if (obstacle.kind === 'star') {
      context.translate(obstacle.x, obstacle.y)
      context.rotate(nowForRotation(obstacle.y))
      context.beginPath()
      for (let point = 0; point < 10; point += 1) {
        const radius = point % 2 === 0 ? obstacle.size / 2 : obstacle.size / 4
        const angle = (point * Math.PI) / 5 - Math.PI / 2
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius
        if (point === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      }
      context.closePath()
      context.fill()
    } else if (obstacle.kind === 'bomb') {
      context.beginPath()
      context.arc(obstacle.x, obstacle.y, obstacle.size / 2, 0, Math.PI * 2)
      context.fill()
      context.fillStyle = '#f2f3e9'
      context.fillRect(obstacle.x - 3, obstacle.y - 3, 6, 6)
    } else if (obstacle.kind === 'orb') {
      context.beginPath()
      context.arc(obstacle.x, obstacle.y, obstacle.size / 2, 0, Math.PI * 2)
      context.fill()
      context.strokeStyle = 'rgba(255,255,255,0.8)'
      context.lineWidth = 2
      context.stroke()
    } else if (obstacle.kind === 'beam') {
      context.fillRect(obstacle.x - obstacle.size / 2, obstacle.y, obstacle.size, 90)
      context.strokeStyle = 'rgba(255,255,255,0.7)'
      context.lineWidth = 2
      context.strokeRect(obstacle.x - obstacle.size / 2 + 4, obstacle.y + 4, obstacle.size - 8, 82)
    } else {
      context.fillRect(obstacle.x - obstacle.size / 2, obstacle.y - obstacle.size / 2, obstacle.size, obstacle.size)
      context.restore()
      context.strokeStyle = 'rgba(255,255,255,0.65)'
      context.strokeRect(obstacle.x - obstacle.size / 2 + 8, obstacle.y - obstacle.size / 2 + 8, obstacle.size - 16, obstacle.size - 16)
      continue
    }
    context.restore()
  }

  const playerX = runtime.x
  const playerBottom = floorY + runtime.jumpY
  if (runtime.mode === 'runner' || runtime.mode === 'dance') {
    drawDinosaur(context, runtime, floorY)
  } else {
    const playerHeight = control.crouch ? 42 : 78
    const playerWidth = control.crouch ? 66 : 48
    const playerTop = playerBottom - playerHeight
    context.save()
    context.shadowColor = '#c4f06f'
    context.shadowBlur = 26
    context.fillStyle = '#c4f06f'
    context.beginPath()
    context.roundRect(playerX - playerWidth / 2, playerTop, playerWidth, playerHeight, 12)
    context.fill()
    context.restore()
    context.fillStyle = '#18231c'
    context.fillRect(playerX - 13, playerTop + 17, 7, 7)
    context.fillRect(playerX + 6, playerTop + 17, 7, 7)
  }
  context.fillStyle = 'rgba(196, 240, 111, 0.25)'
  context.beginPath()
  context.ellipse(playerX, floorY + 5, control.crouch ? 54 : 44, 10, 0, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = 'rgba(246, 245, 233, 0.72)'
  context.font = '600 13px "DM Mono", monospace'
  context.fillText(t(language, playing ? runtime.mode === 'pose' ? 'COPY THE MOVE' : 'TRACK ACTIVE' : 'READY WHEN YOU ARE'), 28, 34)
  context.fillStyle = '#f5f4e9'
  context.font = '700 30px "Barlow Condensed", sans-serif'
  context.fillText(String(runtime.score).padStart(4, '0'), 28, 78)
  if ((runtime.mode === 'pose' || runtime.mode === 'dance') && playing) {
    context.fillStyle = 'rgba(10, 16, 14, 0.76)'
    context.fillRect(width / 2 - 205, 176, 410, 110)
    context.strokeStyle = 'rgba(196, 240, 111, 0.55)'
    context.strokeRect(width / 2 - 205, 176, 410, 110)
    context.fillStyle = '#c4f06f'
    context.textAlign = 'center'
    context.font = '500 12px "DM Mono", monospace'
    context.fillText(t(language, runtime.mode === 'dance' ? 'COPY THE DANCE STEP' : 'NEXT MOVE'), width / 2, 202)
    context.fillStyle = '#f5f4e9'
    context.font = '700 34px "Barlow Condensed", sans-serif'
    context.fillText(challengeLabel(runtime.challenge, language), width / 2, 249)
    context.textAlign = 'left'
  }
  if (!playing) {
    context.fillStyle = 'rgba(10, 16, 14, 0.48)'
    context.fillRect(0, 0, width, height)
    context.fillStyle = '#f5f4e9'
    context.textAlign = 'center'
    context.font = '700 38px "Barlow Condensed", sans-serif'
    context.fillText(t(language, runtime.crashed ? runtime.mode === 'catcher' ? runtime.secondsLeft > 0 ? 'BOMB HIT!' : 'TIME IS UP' : runtime.mode === 'pose' ? 'TIME IS UP' : 'RUN COMPLETE' : runtime.mode === 'pose' ? 'READY TO COPY?' : runtime.mode === 'catcher' ? 'READY TO CATCH?' : 'STEP INTO THE TRACK'), width / 2, height / 2 - 10)
    context.fillStyle = '#c4f06f'
    context.font = '500 14px "DM Mono", monospace'
    context.fillText(t(language, runtime.crashed ? 'RESET TO RUN IT BACK' : 'PRESS START WHEN YOU ARE READY'), width / 2, height / 2 + 22)
    context.textAlign = 'left'
  }
}

function nowForRotation(y: number) {
  return y / 42
}

function drawDinosaur(context: CanvasRenderingContext2D, runtime: Runtime, floorY: number) {
  const x = runtime.x
  const bottom = floorY + runtime.jumpY
  const stride = Math.sin(runtime.lastTime / 90) * 7
  context.save()
  context.translate(x, bottom)
  context.scale(1.45, 1.45)
  context.translate(-x, -bottom)
  context.save()
  context.fillStyle = '#c4f06f'
  context.shadowColor = '#c4f06f'
  context.shadowBlur = 24
  context.beginPath()
  context.moveTo(x - 27, bottom - 39)
  context.lineTo(x - 55, bottom - 51)
  context.lineTo(x - 34, bottom - 25)
  context.lineTo(x - 24, bottom - 27)
  context.closePath()
  context.fill()
  context.beginPath()
  context.roundRect(x - 35, bottom - 51, 65, 35, 11)
  context.fill()
  context.beginPath()
  context.roundRect(x + 3, bottom - 73, 38, 33, 9)
  context.fill()
  context.beginPath()
  context.roundRect(x + 23, bottom - 57, 32, 14, 6)
  context.fill()
  context.restore()

  context.fillStyle = '#c4f06f'
  for (let spike = 0; spike < 4; spike += 1) {
    const spikeX = x - 22 + spike * 12
    context.beginPath()
    context.moveTo(spikeX, bottom - 47)
    context.lineTo(spikeX + 6, bottom - 59 + (spike % 2) * 3)
    context.lineTo(spikeX + 12, bottom - 47)
    context.closePath()
    context.fill()
  }
  context.fillStyle = '#19251c'
  context.beginPath()
  context.arc(x + 29, bottom - 63, 3.1, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#f1f5e5'
  context.fillRect(x + 40, bottom - 51, 6, 3)
  context.strokeStyle = '#c4f06f'
  context.lineWidth = 8
  context.lineCap = 'round'
  context.beginPath()
  context.moveTo(x - 15, bottom - 20)
  context.lineTo(x - 17 + stride, bottom - 7)
  context.lineTo(x - 24 + stride, bottom - 5)
  context.moveTo(x + 9, bottom - 20)
  context.lineTo(x + 11 - stride, bottom - 7)
  context.lineTo(x + 4 - stride, bottom - 5)
  context.stroke()
  context.strokeStyle = 'rgba(196, 240, 111, 0.8)'
  context.lineWidth = 6
  context.beginPath()
  context.moveTo(x - 2, bottom - 42)
  context.lineTo(x + 8, bottom - 33 + stride * 0.35)
  context.stroke()
  context.restore()
}

function GameArtwork() {
  return (
    <section className="bird-scene" aria-label="Sky Sweep dinosaur artwork">
      <div className="scene-copy">
        <p>NEW ARCADE DROP</p>
        <h2>Own the night.</h2>
        <span>RUN FURTHER. MOVE FASTER.</span>
      </div>
      <img className="scene-art" src="/sky-sweep-art.png" alt="Pixel dinosaur running beneath lightning over a neon city" />
    </section>
  )
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameFrameRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const musicRef = useRef<ArcadeMusic | null>(null)
  const framePendingRef = useRef(false)
  const controlRef = useRef<PoseControl>({ ...EMPTY_CONTROL })
  const poseCalibrationRef = useRef<{ centerX: number; shoulderWidth: number } | null>(null)
  const runtimeRef = useRef<Runtime>(createRuntime('dance', 0))
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle')
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[] | null>(null)
  const [action, setAction] = useState('KEYBOARD READY')
  const [score, setScore] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isGameFullscreen, setIsGameFullscreen] = useState(false)
  const [fullscreenError, setFullscreenError] = useState('')
  const [selectedMode, setSelectedMode] = useState<GameMode>('dance')
  const [musicOn, setMusicOn] = useState(true)
  const [musicStyle, setMusicStyle] = useState<MusicStyle>(() => {
    const saved = localStorage.getItem('motion-arcade-music-style')
    return MUSIC_STYLES.some((option) => option.code === saved) ? saved as MusicStyle : 'arcade'
  })
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('motion-arcade-language')
    return LANGUAGES.some((option) => option.code === saved) ? saved as Language : 'en'
  })
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    const saved = localStorage.getItem('motion-arcade-color-theme')
    return COLOR_THEMES.some((option) => option.code === saved) ? saved as ColorTheme : 'arcade'
  })
  const [showHelp, setShowHelp] = useState(false)
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)
  const [appInstalled, setAppInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    let frame = 0
    let lastScorePaint = 0
    let lastDrawAt = 0
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (now - lastDrawAt < 1000 / 60) return
      lastDrawAt = now
      const runtime = runtimeRef.current
      const delta = Math.min((now - (runtime.lastTime || now)) / 1000, 0.04)
      runtime.lastTime = now
      if (isPlaying) {
        const control = controlRef.current
        const targetX = 480 + control.lean * 345
        runtime.x += (targetX - runtime.x) * Math.min(delta * 16, 1)
        if (control.jump && !runtime.jumpWasDown && runtime.jumpY === 0) {
          runtime.jumpVelocity = -720
          playGameSound(musicRef, 'jump')
        }
        runtime.jumpWasDown = control.jump
        runtime.jumpY += runtime.jumpVelocity * delta
        runtime.jumpVelocity += 1900 * delta
        if (runtime.jumpY > 0) {
          runtime.jumpY = 0
          runtime.jumpVelocity = 0
        }
        if (runtime.mode === 'runner' || runtime.mode === 'dance') {
          if (now - runtime.lastSpawn > 1050) {
            runtime.obstacles.push({ x: 140 + Math.floor(Math.random() * 3) * 340, y: -30, size: 42 + Math.random() * 14, hue: Math.random() > 0.5 ? 13 : 186, kind: 'block' })
            runtime.lastSpawn = now
          }
          runtime.obstacles = runtime.obstacles.filter((obstacle) => obstacle.y < 510)
          for (const obstacle of runtime.obstacles) {
            obstacle.y += delta * 235
            const horizontalHit = Math.abs(runtime.x - obstacle.x) < 48 + obstacle.size / 2
            const verticalHit = obstacle.y > 390 && obstacle.y < 475 + runtime.jumpY
            if (horizontalHit && verticalHit && !control.crouch && runtime.jumpY > -24) {
              playGameSound(musicRef, 'hit')
              runtime.crashed = true
              setIsPlaying(false)
              break
            }
          }
          runtime.score += delta * 12
          if (runtime.mode === 'dance' && now >= runtime.nextChallengeAt) {
            if (matchesChallenge(runtime.challenge, control)) {
              runtime.score += 100
              playGameSound(musicRef, 'match')
            }
            const choices = CHALLENGES.filter((challenge) => challenge !== runtime.challenge)
            runtime.challenge = choices[Math.floor(Math.random() * choices.length)]
            runtime.nextChallengeAt = now + 1350
          }
        } else if (runtime.mode === 'catcher') {
          runtime.secondsLeft -= delta
          if (now - runtime.lastSpawn > 700) {
            const kind = Math.random() < 0.24 ? 'bomb' : 'star'
            runtime.obstacles.push({ x: 70 + Math.random() * 820, y: -25, size: kind === 'star' ? 30 : 38, hue: kind === 'star' ? 48 : 8, kind })
            runtime.lastSpawn = now
          }
          for (const item of runtime.obstacles) {
            item.y += delta * 220
            const caught = Math.abs(runtime.x - item.x) < 48 && Math.abs(item.y - 418) < 34
            if (caught) {
              if (item.kind === 'bomb') {
                playGameSound(musicRef, 'hit')
                runtime.crashed = true
                item.y = 600
                setScore(Math.floor(runtime.score))
                setIsPlaying(false)
                break
              }
              runtime.score += 100
              playGameSound(musicRef, 'collect')
              item.y = 600
            }
          }
          runtime.obstacles = runtime.obstacles.filter((item) => item.y < 510)
          if (runtime.secondsLeft <= 0) {
            runtime.secondsLeft = 0
            runtime.crashed = true
            setIsPlaying(false)
          }
        } else if (runtime.mode === 'storm') {
          runtime.secondsLeft -= delta
          if (now - runtime.lastSpawn > 680) {
            const kind = Math.random() < 0.28 ? 'orb' : 'beam'
            runtime.obstacles.push({ x: 100 + Math.random() * 760, y: -40, size: kind === 'orb' ? 24 : 54, hue: kind === 'orb' ? 175 : 12, kind })
            runtime.lastSpawn = now
          }
          for (const item of runtime.obstacles) {
            item.y += delta * 235
            const hitBox = Math.abs(runtime.x - item.x) < 42 + item.size / 2
            const dangerZone = Math.abs(item.y - 416) < 42 + item.size / 2
            if (item.kind === 'orb') {
              if (hitBox && dangerZone) {
                runtime.score += 160
                playGameSound(musicRef, 'collect')
                item.y = 700
              }
            } else if (hitBox && dangerZone) {
              playGameSound(musicRef, 'hit')
              runtime.crashed = true
              setIsPlaying(false)
              break
            }
          }
          runtime.obstacles = runtime.obstacles.filter((item) => item.y < 560)
          if (runtime.secondsLeft <= 0) {
            runtime.secondsLeft = 0
            runtime.crashed = true
            setIsPlaying(false)
          }
        } else {
          runtime.secondsLeft -= delta
          if (now >= runtime.nextChallengeAt) {
            if (matchesChallenge(runtime.challenge, control)) {
              runtime.score += 100
              playGameSound(musicRef, 'match')
            }
            const choices = CHALLENGES.filter((challenge) => challenge !== runtime.challenge)
            runtime.challenge = choices[Math.floor(Math.random() * choices.length)]
            runtime.nextChallengeAt = now + 1350
          }
          if (runtime.secondsLeft <= 0) {
            runtime.secondsLeft = 0
            runtime.crashed = true
            setIsPlaying(false)
          }
        }
        if (now - lastScorePaint > 250) {
          setScore(Math.floor(runtime.score))
          lastScorePaint = now
        }
      }
      drawGame(context, runtime, controlRef.current, isPlaying, language)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying, language])

  useEffect(() => {
    localStorage.setItem('motion-arcade-language', language)
  }, [language])

  useEffect(() => {
    localStorage.setItem('motion-arcade-color-theme', colorTheme)
  }, [colorTheme])

  useEffect(() => {
    localStorage.setItem('motion-arcade-music-style', musicStyle)
  }, [musicStyle])

  useEffect(() => {
    const updateFullscreenState = () => {
      setIsGameFullscreen(document.fullscreenElement === gameFrameRef.current)
    }
    document.addEventListener('fullscreenchange', updateFullscreenState)
    return () => document.removeEventListener('fullscreenchange', updateFullscreenState)
  }, [])

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)')
    const updateInstalledState = () => setAppInstalled(displayMode.matches)
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPrompt)
    }
    const handleAppInstalled = () => {
      setAppInstalled(true)
      setInstallPrompt(null)
    }
    displayMode.addEventListener('change', updateInstalledState)
    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      displayMode.removeEventListener('change', updateInstalledState)
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  useEffect(() => {
    if (cameraStatus !== 'live') return
    let frame = 0
    let lastVideoTime = -1
    let lastCaptureAt = 0
    const capture = () => {
      const video = videoRef.current
      const worker = workerRef.current
      const now = performance.now()
      if (video && worker && !framePendingRef.current && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime !== lastVideoTime && now - lastCaptureAt > 50) {
        lastVideoTime = video.currentTime
        lastCaptureAt = now
        framePendingRef.current = true
        void createImageBitmap(video).then((image) => {
          if (workerRef.current !== worker) {
            image.close()
            framePendingRef.current = false
            return
          }
          worker.postMessage({ type: 'frame', frame: image, timestamp: now }, [image])
        }).catch(() => {
          framePendingRef.current = false
        })
      }
      frame = requestAnimationFrame(capture)
    }
    frame = requestAnimationFrame(capture)
    return () => {
      cancelAnimationFrame(frame)
      framePendingRef.current = false
    }
  }, [cameraStatus])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) event.preventDefault()
      const control = controlRef.current
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') control.lean = -1
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') control.lean = 1
      if (event.key === 'ArrowUp' || event.key === ' ') control.jump = true
      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') control.crouch = true
      if (cameraStatus !== 'live') setAction(event.key === 'ArrowDown' ? 'DUCKING' : event.key === 'ArrowUp' || event.key === ' ' ? 'JUMP READY' : 'KEYBOARD READY')
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a' || event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') controlRef.current.lean = 0
      if (event.key === 'ArrowUp' || event.key === ' ') controlRef.current.jump = false
      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') controlRef.current.crouch = false
      if (cameraStatus !== 'live') setAction('KEYBOARD READY')
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [cameraStatus])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    workerRef.current?.terminate()
    stopArcadeMusic(musicRef)
  }, [])

  useEffect(() => {
    if (isPlaying && musicOn) startArcadeMusic(musicRef, musicStyle)
    else stopArcadeMusic(musicRef)
  }, [isPlaying, musicOn, musicStyle])

  const startCamera = async () => {
    setCameraStatus('loading')
    setErrorMessage('')
    poseCalibrationRef.current = null
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 } }, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      const worker = new Worker(new URL('./pose.worker.ts', import.meta.url), { type: 'module' })
      workerRef.current = worker
      await new Promise<void>((resolve, reject) => {
        let initialized = false
        const timeout = window.setTimeout(() => reject(new Error('Pose model took too long to load. Check your connection and try again.')), 30000)
        worker.onmessage = ({ data }: MessageEvent<PoseWorkerResponse>) => {
          if (data.type === 'ready') {
            initialized = true
            window.clearTimeout(timeout)
            setCameraStatus('live')
            setAction('FINDING PLAYER')
            resolve()
            return
          }
          if (data.type === 'pose') {
            framePendingRef.current = false
            const pose = data.landmarks
            if (pose) {
              setLandmarks(pose)
              const leftKnee = getAngle(pose[23], pose[25], pose[27])
              const rightKnee = getAngle(pose[24], pose[26], pose[28])
              const hipsX = (pose[23].x + pose[24].x) / 2
              const shoulderWidth = Math.abs(pose[11].x - pose[12].x)
              if (!poseCalibrationRef.current && shoulderWidth > 0.04) poseCalibrationRef.current = { centerX: hipsX, shoulderWidth }
              const calibration = poseCalibrationRef.current
              const horizontalScale = Math.max((calibration?.shoulderWidth ?? shoulderWidth) * 1.35, 0.16)
              const lean = calibration ? clamp((calibration.centerX - hipsX) / horizontalScale, -1, 1) : 0
              const torsoHeight = Math.max(Math.abs(((pose[23].y + pose[24].y) - (pose[11].y + pose[12].y)) / 2), 0.12)
              const crouch = (leftKnee + rightKnee) / 2 < 140
              const handsUpMargin = Math.max(torsoHeight * 0.12, 0.025)
              const handsUp = pose[15].y < Math.min(pose[11].y, pose[12].y) - handsUpMargin && pose[16].y < Math.min(pose[11].y, pose[12].y) - handsUpMargin
              controlRef.current = { lean, jump: handsUp, crouch, detected: true }
              setAction(crouch ? 'DUCKING' : handsUp ? 'JUMP READY' : Math.abs(lean) > 0.2 ? lean > 0 ? 'LEAN RIGHT' : 'LEAN LEFT' : 'TRACKING')
            } else {
              setLandmarks(null)
              controlRef.current = { ...EMPTY_CONTROL }
              setAction('FINDING PLAYER')
            }
            return
          }
          framePendingRef.current = false
          window.clearTimeout(timeout)
          reject(new Error(data.message))
        }
        worker.onerror = () => {
          framePendingRef.current = false
          window.clearTimeout(timeout)
          reject(new Error('Pose worker stopped unexpectedly.'))
        }
        worker.postMessage({ type: 'init' })
        void initialized
      })
    } catch (error) {
      workerRef.current?.terminate()
      workerRef.current = null
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setCameraStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Camera setup failed. Check permissions and try again.')
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    workerRef.current?.terminate()
    workerRef.current = null
    framePendingRef.current = false
    if (videoRef.current) videoRef.current.srcObject = null
    controlRef.current = { ...EMPTY_CONTROL }
    poseCalibrationRef.current = null
    setLandmarks(null)
    setCameraStatus('idle')
    setAction('KEYBOARD READY')
  }

  const startRun = () => {
    runtimeRef.current = createRuntime(selectedMode, performance.now())
    setScore(0)
    setIsPlaying(true)
  }

  const toggleMusic = () => {
    setMusicOn((enabled) => !enabled)
  }

  const installApp = async () => {
    if (!installPrompt) {
      setShowInstallHelp(true)
      return
    }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallPrompt(null)
    if (choice.outcome === 'accepted') setAppInstalled(true)
  }

  const toggleGameFullscreen = async () => {
    setFullscreenError('')
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }
      const gameFrame = gameFrameRef.current
      if (!gameFrame?.requestFullscreen) {
        setFullscreenError('Fullscreen is not supported by this browser.')
        return
      }
      await gameFrame.requestFullscreen()
    } catch (error) {
      setFullscreenError(error instanceof Error ? error.message : 'Could not enter fullscreen mode.')
    }
  }

  const overlayLandmarks = landmarks?.length ? landmarks : null
  const bodyPointerPosition = overlayLandmarks ? clamp(50 + controlRef.current.lean * 50, 0, 100) : 50
  const activeGame = GAMES.find((game) => game.id === selectedMode) ?? GAMES[0]

  return (
    <main className="app-shell" lang={language} data-color-theme={colorTheme}>
      <header className="topbar">
        <div className="titlebar-brand"><div className="window-controls" aria-hidden="true"><i /><i /><i /></div><a className="brand" href="#top" aria-label="Motion Arcade home"><img className="brand-mark" src="/app-icon.svg" alt="" /><span>MOTION<span className="brand-light">ARCADE</span></span></a><span className="desktop-edition">DESKTOP ARCADE</span></div>
        <div className="topbar-right"><span className={`connection-dot ${cameraStatus === 'live' ? 'is-live' : ''}`} /><span className="connection-label">{t(language, cameraStatus === 'live' ? 'CAMERA LINKED' : 'LOCAL PLAY')}</span><label className="language-control"><span>{t(language, 'Language')}</span><select aria-label={t(language, 'Language')} value={language} onChange={(event) => setLanguage(event.target.value as Language)}>{LANGUAGES.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label><label className="language-control color-theme-control"><Palette size={14} aria-hidden="true" /><span>COLORS</span><select aria-label="Color theme" value={colorTheme} onChange={(event) => setColorTheme(event.target.value as ColorTheme)}>{COLOR_THEMES.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label>{!appInstalled && <button className="install-app-button" onClick={() => void installApp()} aria-label="Install Motion Arcade" title="Install Motion Arcade"><Download size={15} /><span>INSTALL APP</span></button>}<button className="icon-button help-button" aria-label={t(language, 'Movement guide')} title={t(language, 'Movement guide')} onClick={() => setShowHelp(true)}><CircleHelp size={18} /></button></div>
      </header>

      <section className="intro" id="top"><div className="intro-copy"><p className="eyebrow"><span /> {t(language, 'BODY-POWERED PLAY')}</p><h1>{t(language, 'Move your body.')}<br /><em>{t(language, 'Move the game.')}</em></h1></div><p className="intro-note">{t(language, 'No controller needed.')}<br />{t(language, 'Just step into frame and play.')}</p></section>

      <GameArtwork />

      <section className="arcade-grid" aria-label={t(language, 'Motion Arcade game')}>
        <div className="game-column">
          <div className="section-heading"><div><p className="eyebrow">01 / {t(language, 'MINI GAMES')}</p><h2>{t(language, activeGame.name)}</h2></div><div className="run-score"><span>{t(language, selectedMode === 'catcher' ? 'STARS CAUGHT' : selectedMode === 'pose' ? 'MOVES MATCHED' : selectedMode === 'dance' ? 'DANCE SCORE' : selectedMode === 'storm' ? 'ORBS COLLECTED' : 'YOUR SCORE')}</span><strong>{String(score).padStart(4, '0')}</strong></div></div>
          <div className="game-picker" role="group" aria-label={t(language, 'Choose a mini game')}>{GAMES.map((game) => { const Icon = game.icon; return <button key={game.id} className={`game-choice ${selectedMode === game.id ? 'selected' : ''}`} aria-pressed={selectedMode === game.id} onClick={() => { setSelectedMode(game.id); setIsPlaying(false); runtimeRef.current = createRuntime(game.id, performance.now()); setScore(0) }}><span className="game-choice-icon"><Icon size={16} /></span><span className="game-choice-copy"><b>{t(language, game.name)}</b><small>{t(language, game.detail)}</small></span><span className="game-choice-tag">{t(language, game.label)}</span></button> })}</div>
          <div ref={gameFrameRef} className={`game-frame ${isGameFullscreen ? 'game-frame-fullscreen' : ''}`}>
            <canvas ref={canvasRef} className="game-canvas" width="960" height="540" aria-label={t(language, activeGame.name)} />
            <div className="game-corner game-corner-top"><span className={`live-pill ${isPlaying ? 'active' : ''}`}><i />{t(language, isPlaying ? 'IN PLAY' : 'STANDBY')}</span><span className="game-round">{isPlaying && (selectedMode === 'catcher' || selectedMode === 'pose' || selectedMode === 'storm') ? `${Math.ceil(runtimeRef.current.secondsLeft)} ${t(language, 'SEC')}` : t(language, 'ROUND 01')}</span></div>
            <button className="game-fullscreen-button" onClick={() => void toggleGameFullscreen()} aria-label={isGameFullscreen ? 'Exit fullscreen' : 'Fullscreen game'} title={isGameFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen game'}>
              {isGameFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            {isGameFullscreen && <button className="primary-button game-fullscreen-play" onClick={() => isPlaying ? setIsPlaying(false) : startRun()}>{isPlaying ? <><X size={17} /> {t(language, 'END RUN')}</> : runtimeRef.current.crashed ? <><RotateCcw size={17} /> {t(language, 'PLAY AGAIN')}</> : <><Play size={17} fill="currentColor" /> {t(language, 'START RUN')}</>}</button>}
            {fullscreenError && <span className="fullscreen-error" role="alert">{fullscreenError}</span>}
            {runtimeRef.current.crashed && !isPlaying && <div className="crash-score">{t(language, 'FINAL SCORE')} <b>{String(score).padStart(4, '0')}</b></div>}
          </div>
          <div className="game-toolbar"><div className="action-readout"><span className="action-glyph"><Activity size={16} /></span><span><small>{t(language, 'YOUR MOVE')}</small><strong>{t(language, action)}</strong></span></div><div className="run-actions"><label className="music-style-control"><Music2 size={16} aria-hidden="true" /><span>SOUNDTRACK</span><select aria-label="Music style" value={musicStyle} onChange={(event) => setMusicStyle(event.target.value as MusicStyle)}>{MUSIC_STYLES.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label><button className="music-toggle" aria-label={musicOn ? 'Mute game audio' : 'Enable game audio'} aria-pressed={musicOn} title={musicOn ? 'Mute game audio' : 'Enable game audio'} onClick={toggleMusic}>{musicOn ? <Volume2 size={17} /> : <VolumeX size={17} />}<span>{musicOn ? 'SOUND ON' : 'SOUND OFF'}</span></button><button className="primary-button" onClick={() => isPlaying ? setIsPlaying(false) : startRun()}>{isPlaying ? <><X size={17} /> {t(language, 'END RUN')}</> : runtimeRef.current.crashed ? <><RotateCcw size={17} /> {t(language, 'PLAY AGAIN')}</> : <><Play size={17} fill="currentColor" /> {t(language, 'START RUN')}</>}</button></div></div>
          <p className="game-footnote"><Sparkles size={14} /> {t(language, selectedMode === 'dance' ? 'Copy each dance step, dodge blocks, and run to the beat.' : selectedMode === 'runner' ? 'Dodge blocks. Raise your hands to jump; crouch to duck.' : selectedMode === 'catcher' ? 'Move under the falling stars. Catch gold, avoid red bombs.' : selectedMode === 'storm' ? 'Swerve through the storm. Dodge laser beams and grab the glowing orbs.' : 'Copy the prompt before it changes. Match each move for 100 points.')}</p>
        </div>

        <aside className="camera-panel" aria-label={t(language, 'PLAYER TRACKING')}>
          <div className="panel-heading"><div><p className="eyebrow">02 / {t(language, 'PLAYER TRACKING')}</p><h2>{t(language, 'Step into frame')}</h2></div><span className={`tracking-status ${cameraStatus === 'live' ? 'is-live' : ''}`}><i />{t(language, cameraStatus === 'live' ? 'LIVE' : cameraStatus === 'loading' ? 'LOADING' : cameraStatus === 'error' ? 'ERROR' : 'OFFLINE')}</span></div>
          <div className={`camera-view ${cameraStatus === 'live' ? 'camera-active' : ''}`}>
            <video ref={videoRef} className="camera-video" playsInline muted />
            {overlayLandmarks && <svg className="pose-overlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true"><g className="pose-bones">{SKELETON.map(([from, to]) => <line key={`${from}-${to}`} x1={overlayLandmarks[from].x} y1={overlayLandmarks[from].y} x2={overlayLandmarks[to].x} y2={overlayLandmarks[to].y} />)}</g><g className="pose-joints">{overlayLandmarks.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="0.009" />)}</g></svg>}
            {cameraStatus !== 'live' && <div className="camera-placeholder"><div className="camera-orbit"><span /><span /><Camera size={25} /></div><strong>{t(language, cameraStatus === 'loading' ? 'Warming up the camera' : cameraStatus === 'error' ? 'Could not connect' : 'Camera is waiting')}</strong><small>{t(language, cameraStatus === 'loading' ? 'Loading the pose model and asking permission' : cameraStatus === 'error' ? errorMessage : 'Full body in frame works best')}</small></div>}
            {cameraStatus === 'live' && <span className="camera-viewfinder viewfinder-tl" />}{cameraStatus === 'live' && <span className="camera-viewfinder viewfinder-br" />}
            {cameraStatus === 'live' && <div className="body-pointer-track"><span className="pointer-label">{t(language, 'BODY POSITION')}</span><span className="pointer-rail"><i style={{ left: `${bodyPointerPosition}%` }} /></span></div>}
            {cameraStatus === 'live' && <span className="pose-tag"><span /> {t(language, landmarks ? 'POSE DETECTED' : 'SEARCHING')}</span>}
          </div>
          <button className={`camera-button ${cameraStatus === 'live' ? 'camera-button-off' : ''}`} onClick={cameraStatus === 'live' ? stopCamera : startCamera} disabled={cameraStatus === 'loading'}>{cameraStatus === 'live' ? <><CameraOff size={17} /> {t(language, 'DISCONNECT CAMERA')}</> : cameraStatus === 'loading' ? <><span className="button-spinner" /> {t(language, 'CONNECTING...')}</> : <><Camera size={17} /> {t(language, 'CONNECT CAMERA')}</>}</button>
          <div className="movement-list"><div className="movement-title"><span>{t(language, 'MOVE SET')}</span><span>{t(language, '3 GESTURES')}</span></div><div className="movement-row"><span className="movement-icon"><ArrowLeft size={15} /><ArrowRight size={15} /></span><span><b>{t(language, 'Lean')}</b><small>{t(language, 'Shift left or right')}</small></span><span className="move-result">{t(language, 'STEER')}</span></div><div className="movement-row"><span className="movement-icon"><ArrowUp size={17} /></span><span><b>{t(language, 'Raise both hands')}</b><small>{t(language, 'Jump over a block')}</small></span><span className="move-result">{t(language, 'JUMP')}</span></div><div className="movement-row"><span className="movement-icon"><ArrowDown size={17} /></span><span><b>{t(language, 'Crouch')}</b><small>{t(language, 'Duck under danger')}</small></span><span className="move-result">{t(language, 'DUCK')}</span></div></div>
          {cameraStatus === 'error' && <p className="error-note">{errorMessage}</p>}
        </aside>
      </section>

      <footer className="page-footer"><span><Gamepad2 size={15} /> MOTION ARCADE <span className="footer-divider">/</span> {t(language, 'BUILT TO MOVE')}</span><span>{t(language, 'CAMERA PROCESSING STAYS IN YOUR BROWSER')}</span></footer>

      {showHelp && <div className="modal-backdrop" role="presentation" onClick={() => setShowHelp(false)}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={(event) => event.stopPropagation()}><button className="icon-button modal-close" aria-label={t(language, 'Close guide')} onClick={() => setShowHelp(false)}><X size={18} /></button><p className="eyebrow">{t(language, 'QUICK GUIDE')}</p><h2 id="help-title">{t(language, 'Play your way.')}</h2><p>{t(language, 'Connect your camera to let the pose tracker read your movement. Your video is processed locally and is never uploaded.')}</p><div className="help-shortcuts"><span><ArrowLeft size={15} /><ArrowRight size={15} /> <b>{t(language, 'STEER')}</b><small>← →</small></span><span><ArrowUp size={15} /><b>{t(language, 'JUMP')}</b><small>↑</small></span><span><ArrowDown size={15} /><b>{t(language, 'DUCK')}</b><small>↓</small></span></div><button className="primary-button" onClick={() => setShowHelp(false)}>{t(language, 'GOT IT')}</button></section></div>}
      {showInstallHelp && <div className="modal-backdrop" role="presentation" onClick={() => setShowInstallHelp(false)}><section className="help-modal install-help-modal" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={(event) => event.stopPropagation()}><button className="icon-button modal-close" aria-label="Close install instructions" onClick={() => setShowInstallHelp(false)}><X size={18} /></button><p className="eyebrow">DESKTOP APP</p><h2 id="install-title">Install Motion Arcade</h2><p>In Microsoft Edge, open <b>Settings and more &gt; Apps &gt; Install this site as an app</b>. In Chrome, open <b>More &gt; Cast, save, and share &gt; Install page as app</b>.</p><button className="primary-button" onClick={() => setShowInstallHelp(false)}>GOT IT</button></section></div>}
    </main>
  )
}

export default App
