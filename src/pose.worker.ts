import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

type WorkerRequest = { type: 'init' } | { type: 'frame'; frame: ImageBitmap; timestamp: number } | { type: 'dispose' }
type WorkerResponse = { type: 'ready' } | { type: 'pose'; landmarks: { x: number; y: number; z: number; visibility?: number }[] | null } | { type: 'error'; message: string }

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage: (message: WorkerResponse) => void
  close: () => void
}

let landmarker: PoseLandmarker | null = null

workerScope.onmessage = async ({ data }) => {
  if (data.type === 'dispose') {
    landmarker?.close()
    landmarker = null
    workerScope.close()
    return
  }

  if (data.type === 'init') {
    try {
      const vision = await FilesetResolver.forVisionTasks(`${self.location.origin}/wasm`, true)
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/pose_landmarker_lite.task',
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55,
      })
      workerScope.postMessage({ type: 'ready' })
    } catch (error) {
      workerScope.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Pose model failed to load.' })
    }
    return
  }

  try {
    const landmarks = landmarker?.detectForVideo(data.frame, data.timestamp).landmarks[0] ?? null
    data.frame.close()
    workerScope.postMessage({ type: 'pose', landmarks })
  } catch (error) {
    data.frame.close()
    workerScope.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Pose detection failed.' })
  }
}