import { createGreenArrowDetector } from './arrow-detection.js'

const canvas = document.querySelector('#game')
const context = canvas.getContext('2d')
const scoreElement = document.querySelector('#score')
const statusElement = document.querySelector('#status')
const overlay = document.querySelector('#overlay')
const overlayTitle = document.querySelector('#overlay-title')
const overlayCopy = document.querySelector('#overlay-copy')
const startButton = document.querySelector('#start-button')
const camera = document.querySelector('#camera')
const cameraPreview = document.querySelector('#camera-preview')
const cameraStatus = document.querySelector('#camera-status')
const cameraButton = document.querySelector('#camera-button')
const detectBadge = document.querySelector('#detect-badge')
const cameraLiveLabel = document.querySelector('#camera-live-label')
const detectorCanvas = document.createElement('canvas')
const detectorContext = detectorCanvas.getContext('2d', { willReadFrequently: true })
const detectorWidth = 320
const detectorHeight = 240
const detectArrowDirection = createGreenArrowDetector(detectorWidth, detectorHeight)

const laneCount = 3
const state = {
  running: false,
  gameOver: false,
  lane: 1,
  carLane: 1,
  pointingDirection: 0,
  distance: 0,
  speed: 270,
  spawnIn: 0.8,
  roadOffset: 0,
  obstacles: [],
  lastFrame: 0,
  stars: Array.from({ length: 46 }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: Math.random() * 1.4 + 0.35,
    phase: Math.random() * Math.PI * 2,
  })),
}

let width = 0
let height = 0
let pixelRatio = 1
let cameraStream = null
let cameraFrame = 0
let lastScan = 0
let candidateDirection = 0
let candidateFrames = 0
let stableDirection = 0

detectorCanvas.width = detectorWidth
detectorCanvas.height = detectorHeight

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect()
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  width = rect.width
  height = rect.height
  canvas.width = Math.round(width * pixelRatio)
  canvas.height = Math.round(height * pixelRatio)
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  draw()
}

function roadMetrics() {
  const roadTop = height * 0.05
  const roadBottom = height * 1.08
  const topWidth = width * 0.27
  const bottomWidth = width * 0.82
  const center = width / 2
  const roadLeftAt = (progress) => center - (topWidth + (bottomWidth - topWidth) * progress) / 2
  const roadWidthAt = (progress) => topWidth + (bottomWidth - topWidth) * progress
  const yAt = (progress) => roadTop + (roadBottom - roadTop) * progress
  const laneX = (lane, progress) => roadLeftAt(progress) + roadWidthAt(progress) * (lane + 0.5) / laneCount
  return { roadTop, roadBottom, roadLeftAt, roadWidthAt, yAt, laneX }
}

function roundedRect(x, y, rectWidth, rectHeight, radius) {
  context.beginPath()
  context.roundRect(x, y, rectWidth, rectHeight, radius)
}

function drawCar(x, y, scale, color, isPlayer = false) {
  const carWidth = (isPlayer ? 37 : 32) * scale
  const carHeight = (isPlayer ? 68 : 54) * scale
  context.save()
  context.translate(x, y)
  context.shadowColor = color
  context.shadowBlur = isPlayer ? 21 : 10
  context.fillStyle = color
  roundedRect(-carWidth / 2, -carHeight / 2, carWidth, carHeight, 8 * scale)
  context.fill()
  context.shadowBlur = 0
  context.fillStyle = isPlayer ? '#151225' : '#101327'
  roundedRect(-carWidth * 0.34, -carHeight * 0.29, carWidth * 0.68, carHeight * 0.3, 4 * scale)
  context.fill()
  roundedRect(-carWidth * 0.3, carHeight * 0.12, carWidth * 0.6, carHeight * 0.19, 4 * scale)
  context.fill()
  context.fillStyle = isPlayer ? '#fff3ff' : '#ffcfeb'
  context.fillRect(-carWidth * 0.31, carHeight * 0.37, carWidth * 0.19, 3 * scale)
  context.fillRect(carWidth * 0.12, carHeight * 0.37, carWidth * 0.19, 3 * scale)
  context.fillStyle = '#171728'
  context.fillRect(-carWidth * 0.56, -carHeight * 0.27, carWidth * 0.14, carHeight * 0.23)
  context.fillRect(carWidth * 0.42, -carHeight * 0.27, carWidth * 0.14, carHeight * 0.23)
  context.fillRect(-carWidth * 0.56, carHeight * 0.17, carWidth * 0.14, carHeight * 0.23)
  context.fillRect(carWidth * 0.42, carHeight * 0.17, carWidth * 0.14, carHeight * 0.23)
  context.restore()
}

function drawArrow(x, y, direction) {
  context.save()
  context.translate(x, y)
  context.rotate(direction * -0.48)
  context.strokeStyle = '#f6a5ed'
  context.fillStyle = '#f6a5ed'
  context.lineWidth = 3
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.shadowColor = '#d36bff'
  context.shadowBlur = 14
  context.beginPath()
  context.moveTo(0, 12)
  context.lineTo(0, -12)
  context.stroke()
  context.beginPath()
  context.moveTo(-7, -5)
  context.lineTo(0, -13)
  context.lineTo(7, -5)
  context.closePath()
  context.fill()
  context.restore()
}

function draw() {
  if (!width || !height) return
  const metrics = roadMetrics()
  context.clearRect(0, 0, width, height)

  const sky = context.createLinearGradient(0, 0, 0, height)
  sky.addColorStop(0, '#090a19')
  sky.addColorStop(0.56, '#11142a')
  sky.addColorStop(1, '#171028')
  context.fillStyle = sky
  context.fillRect(0, 0, width, height)

  const glow = context.createRadialGradient(width * 0.5, height * 0.64, 4, width * 0.5, height * 0.64, width * 0.5)
  glow.addColorStop(0, 'rgba(139, 73, 195, 0.25)')
  glow.addColorStop(1, 'rgba(39, 77, 140, 0)')
  context.fillStyle = glow
  context.fillRect(0, 0, width, height)

  for (const star of state.stars) {
    const twinkle = 0.45 + Math.sin(performance.now() * 0.0015 + star.phase) * 0.25
    context.globalAlpha = twinkle
    context.fillStyle = '#d5caff'
    context.beginPath()
    context.arc(star.x * width, star.y * height * 0.72, star.size, 0, Math.PI * 2)
    context.fill()
  }
  context.globalAlpha = 1

  context.beginPath()
  context.moveTo(metrics.roadLeftAt(0), metrics.roadTop)
  context.lineTo(metrics.roadLeftAt(1), metrics.roadBottom)
  context.lineTo(metrics.roadLeftAt(1) + metrics.roadWidthAt(1), metrics.roadBottom)
  context.lineTo(metrics.roadLeftAt(0) + metrics.roadWidthAt(0), metrics.roadTop)
  context.closePath()
  const roadGradient = context.createLinearGradient(0, 0, 0, height)
  roadGradient.addColorStop(0, '#15182a')
  roadGradient.addColorStop(1, '#202035')
  context.fillStyle = roadGradient
  context.fill()

  context.strokeStyle = 'rgba(199, 143, 244, 0.58)'
  context.lineWidth = 2
  for (const side of [0, 1]) {
    const offset = side === 0 ? 0 : 1
    context.beginPath()
    context.moveTo(metrics.roadLeftAt(0) + metrics.roadWidthAt(0) * offset, metrics.roadTop)
    context.lineTo(metrics.roadLeftAt(1) + metrics.roadWidthAt(1) * offset, metrics.roadBottom)
    context.stroke()
  }
  context.shadowColor = 'rgba(166, 104, 249, 0.85)'
  context.shadowBlur = 10
  for (let lane = 1; lane < laneCount; lane += 1) {
    const fraction = lane / laneCount
    for (let mark = 0; mark < 11; mark += 1) {
      const progress = ((mark / 11 + state.roadOffset) % 1)
      const nextProgress = Math.min(progress + (0.018 + progress * 0.016), 1)
      const x1 = metrics.roadLeftAt(progress) + metrics.roadWidthAt(progress) * fraction
      const x2 = metrics.roadLeftAt(nextProgress) + metrics.roadWidthAt(nextProgress) * fraction
      context.beginPath()
      context.moveTo(x1, metrics.yAt(progress))
      context.lineTo(x2, metrics.yAt(nextProgress))
      context.strokeStyle = `rgba(182, 158, 255, ${0.22 + progress * 0.56})`
      context.lineWidth = 1 + progress * 3
      context.stroke()
    }
  }
  context.shadowBlur = 0

  for (const obstacle of state.obstacles) {
    const scale = 0.45 + obstacle.progress * 0.72
    drawCar(metrics.laneX(obstacle.lane, obstacle.progress), metrics.yAt(obstacle.progress), scale, obstacle.color)
  }

  const playerY = height * 0.81
  const carLaneX = metrics.laneX(state.carLane, 0.77)
  drawCar(carLaneX, playerY, 1.08, '#bd8cff', true)
  drawArrow(carLaneX, playerY - 55, state.pointingDirection)

  const vignette = context.createRadialGradient(width / 2, height / 2, height * 0.24, width / 2, height / 2, width * 0.72)
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vignette.addColorStop(1, 'rgba(3, 4, 12, 0.52)')
  context.fillStyle = vignette
  context.fillRect(0, 0, width, height)
}

function update(delta) {
  if (!state.running) {
    draw()
    return
  }

  state.distance += delta * (12 + state.speed / 45)
  state.speed = Math.min(510, state.speed + delta * 2.4)
  state.roadOffset = (state.roadOffset + delta * state.speed / 330) % 1
  state.carLane += (state.lane - state.carLane) * Math.min(1, delta * 9)
  state.spawnIn -= delta

  if (state.spawnIn <= 0) {
    const occupied = state.obstacles.filter((obstacle) => obstacle.progress < 0.34).map((obstacle) => obstacle.lane)
    const openLanes = [0, 1, 2].filter((lane) => !occupied.includes(lane))
    const lane = openLanes[Math.floor(Math.random() * openLanes.length)]
    if (lane !== undefined) {
      state.obstacles.push({
        lane,
        progress: 0,
        color: ['#ff70bd', '#62b8ff', '#ffaf70'][Math.floor(Math.random() * 3)],
      })
    }
    state.spawnIn = Math.max(0.5, 1.13 - state.speed / 900) + Math.random() * 0.3
  }

  for (const obstacle of state.obstacles) {
    obstacle.progress += delta * state.speed / 430
    if (obstacle.progress > 0.72 && obstacle.progress < 0.88 && Math.round(state.carLane) === obstacle.lane) {
      endGame()
      break
    }
  }
  state.obstacles = state.obstacles.filter((obstacle) => obstacle.progress < 1.12)
  scoreElement.textContent = String(Math.floor(state.distance)).padStart(5, '0')
  draw()
}

function frame(time) {
  const delta = Math.min((time - (state.lastFrame || time)) / 1000, 0.04)
  state.lastFrame = time
  update(delta)
  requestAnimationFrame(frame)
}

function startGame() {
  state.running = true
  state.gameOver = false
  state.lane = 1
  state.carLane = 1
  stableDirection = 0
  candidateDirection = 0
  candidateFrames = 0
  state.distance = 0
  state.speed = 270
  state.spawnIn = 0.8
  state.roadOffset = 0
  state.obstacles = []
  scoreElement.textContent = '00000'
  statusElement.textContent = 'DRIVE IN PROGRESS'
  overlay.classList.add('hidden')
}

function endGame() {
  state.running = false
  state.gameOver = true
  statusElement.textContent = 'DRIVE ENDED'
  overlayTitle.textContent = 'Road trip over.'
  overlayCopy.textContent = `You drove ${Math.floor(state.distance)} distance. Point the arrow and try again.`
  startButton.innerHTML = 'DRIVE AGAIN <span aria-hidden="true">→</span>'
  overlay.classList.remove('hidden')
}

function steer(direction) {
  state.pointingDirection = direction
  if (!state.running) return
  const nextLane = Math.max(0, Math.min(laneCount - 1, state.lane + direction))
  if (nextLane === state.lane) return
  state.lane = nextLane
}

function detectGreenArrow() {
  if (camera.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null

  detectorContext.drawImage(camera, 0, 0, detectorWidth, detectorHeight)
  const direction = detectArrowDirection(
    detectorContext.getImageData(0, 0, detectorWidth, detectorHeight),
  )
  return direction === 'left' ? { direction: -1 } : direction === 'right' ? { direction: 1 } : null
}

function updateCameraStatus(message, detected = false) {
  cameraStatus.textContent = message
  detectBadge.textContent = detected
    ? `GREEN ARROW ${candidateDirection < 0 ? '← LEFT' : 'RIGHT →'}`
    : message.toUpperCase()
  detectBadge.classList.toggle('detected', detected)
}

function scanCamera(time) {
  if (!cameraStream) return
  cameraFrame = requestAnimationFrame(scanCamera)
  if (time - lastScan < 120) return
  lastScan = time

  const detection = detectGreenArrow()
  if (!detection) {
    candidateDirection = 0
    candidateFrames = 0
    stableDirection = 0
    state.pointingDirection = 0
    updateCameraStatus('Looking for a green left/right arrow')
    return
  }

  if (detection.direction === candidateDirection) {
    candidateFrames += 1
  } else {
    candidateDirection = detection.direction
    candidateFrames = 1
  }
  if (candidateFrames < 3) return

  state.pointingDirection = detection.direction
  updateCameraStatus(detection.direction < 0 ? 'Green arrow points left' : 'Green arrow points right', true)
  if (stableDirection !== detection.direction) steer(detection.direction)
  stableDirection = detection.direction
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera access is not available here. Open the game on localhost or HTTPS in a supported browser.')
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
  })
  cameraStream = stream
  stream.getVideoTracks()[0]?.addEventListener('ended', stopCamera, { once: true })
  camera.srcObject = stream
  try {
    await camera.play()
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop())
    cameraStream = null
    camera.srcObject = null
    throw error
  }

  cameraPreview.classList.add('is-live')
  cameraButton.textContent = 'DISCONNECT CAMERA'
  cameraStatus.textContent = 'Camera on. Hold a green arrow horizontally in view.'
  detectBadge.textContent = 'SEARCHING'
  cameraLiveLabel.textContent = '/ CAMERA ON'
  delete startButton.dataset.keyboardFallback
  if (!state.running) {
    statusElement.textContent = state.gameOver ? 'DRIVE ENDED' : 'READY TO DRIVE'
    overlayTitle.textContent = 'Ready, driver?'
    overlayCopy.textContent = 'Show a green arrow to your camera. Point it left or right and the car will follow.'
    startButton.innerHTML = state.gameOver
      ? 'DRIVE AGAIN <span aria-hidden="true">→</span>'
      : 'START DRIVING <span aria-hidden="true">→</span>'
  }
  lastScan = 0
  candidateDirection = 0
  candidateFrames = 0
  stableDirection = 0
  cameraFrame = requestAnimationFrame(scanCamera)
}

function stopCamera() {
  if (cameraFrame) cancelAnimationFrame(cameraFrame)
  cameraFrame = 0
  cameraStream?.getTracks().forEach((track) => track.stop())
  cameraStream = null
  camera.srcObject = null
  cameraPreview.classList.remove('is-live')
  cameraButton.textContent = 'ENABLE CAMERA →'
  cameraLiveLabel.textContent = '/ CAMERA STEERING'
  stableDirection = 0
  candidateDirection = 0
  candidateFrames = 0
  state.pointingDirection = 0
  if (state.running) {
    updateCameraStatus('Camera disconnected. Use arrow keys to keep playing.')
  } else {
    updateCameraStatus('Camera is off. Allow camera access when prompted.')
  }
}

async function handleStartClick() {
  startButton.disabled = true
  try {
    if (startButton.dataset.keyboardFallback === 'true') {
      delete startButton.dataset.keyboardFallback
      cameraLiveLabel.textContent = '/ KEYBOARD MODE'
      cameraStatus.textContent = 'Camera unavailable. Use the left/right arrow keys or A/D to steer.'
      startGame()
      return
    }
    if (!cameraStream) await startCamera()
    overlayTitle.textContent = 'Ready, driver?'
    overlayCopy.textContent = 'Show a green arrow to your camera. Point it left or right and the car will follow.'
    startGame()
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'Could not start the camera. Check your browser permissions and try again.'
    cameraStatus.textContent = message
    statusElement.textContent = 'CAMERA NEEDS ACCESS'
    overlayTitle.textContent = 'Camera needed.'
    overlayCopy.textContent = `${message} Allow camera access and retry, or continue with keyboard steering.`
    startButton.dataset.keyboardFallback = 'true'
    startButton.innerHTML = 'CONTINUE WITH KEYBOARD <span aria-hidden="true">→</span>'
    overlay.classList.remove('hidden')
  } finally {
    startButton.disabled = false
  }
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase()
  if (['arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault()

  if (key === 'enter' || key === ' ') {
    if (!state.running) void handleStartClick()
    return
  }
  if (key === 'arrowleft' || key === 'a') steer(-1)
  if (key === 'arrowright' || key === 'd') steer(1)
}

startButton.addEventListener('click', () => void handleStartClick())
cameraButton.addEventListener('click', () => {
  if (cameraStream) {
    stopCamera()
    return
  }

  cameraButton.disabled = true
  void startCamera().catch((error) => {
    const message = error instanceof Error
      ? error.message
      : 'Could not start the camera. Check your browser permissions and try again.'
    cameraStatus.textContent = message
    statusElement.textContent = 'CAMERA NEEDS ACCESS'
    updateCameraStatus('Camera access needed')
  }).finally(() => {
    cameraButton.disabled = false
  })
})
window.addEventListener('keydown', handleKeyDown)
window.addEventListener('pagehide', stopCamera)
window.addEventListener('resize', resizeCanvas)
resizeCanvas()
requestAnimationFrame(frame)
