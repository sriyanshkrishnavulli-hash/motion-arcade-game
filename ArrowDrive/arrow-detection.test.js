import assert from 'node:assert/strict'
import test from 'node:test'
import { createGreenArrowDetector } from './arrow-detection.js'

const width = 320
const height = 240

function makeArrow(direction, scale = 1.8, color = [24, 240, 0]) {
  const data = new Uint8ClampedArray(width * height * 4)
  const basePoints = direction === 'right'
    ? [[17, 50], [85, 50], [85, 25], [145, 60], [85, 95], [85, 70], [17, 70]]
    : [[143, 50], [75, 50], [75, 25], [15, 60], [75, 95], [75, 70], [143, 70]]
  const points = basePoints.map(([x, y]) => [
    (x - 80) * scale + width / 2,
    (y - 60) * scale + height / 2,
  ])

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let inside = false
      for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
        const [x1, y1] = points[index]
        const [x2, y2] = points[previous]
        if ((y1 > y) !== (y2 > y) && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) {
          inside = !inside
        }
      }
      if (!inside) continue
      const pixel = (y * width + x) * 4
      data[pixel] = color[0]
      data[pixel + 1] = color[1]
      data[pixel + 2] = color[2]
      data[pixel + 3] = 255
    }
  }
  return { data }
}

test('detects a green arrow pointing right', () => {
  const detect = createGreenArrowDetector(width, height)
  assert.equal(detect(makeArrow('right')), 'right')
})

test('detects a green arrow pointing left', () => {
  const detect = createGreenArrowDetector(width, height)
  assert.equal(detect(makeArrow('left')), 'left')
})

test('detects a small green arrow', () => {
  const detect = createGreenArrowDetector(width, height)
  assert.equal(detect(makeArrow('right', 0.12)), 'right')
})

test('detects a dim green arrow', () => {
  const detect = createGreenArrowDetector(width, height)
  assert.equal(detect(makeArrow('left', 1.8, [70, 125, 55])), 'left')
})

test('ignores a green rectangle without an arrow tip', () => {
  const detect = createGreenArrowDetector(width, height)
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 90; y < 150; y += 1) {
    for (let x = 85; x < 235; x += 1) {
      const pixel = (y * width + x) * 4
      data[pixel] = 24
      data[pixel + 1] = 240
      data[pixel + 2] = 0
      data[pixel + 3] = 255
    }
  }
  assert.equal(detect({ data }), null)
})
