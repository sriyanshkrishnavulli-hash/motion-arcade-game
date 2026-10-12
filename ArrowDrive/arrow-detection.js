export function createGreenArrowDetector(width, height) {
  const size = width * height
  const mask = new Uint8Array(size)
  const visited = new Uint8Array(size)
  const queue = new Uint32Array(size)
  const componentColumns = new Uint16Array(width)
  const largestColumns = new Uint16Array(width)

  return function detectGreenArrow(imageData) {
    const pixels = imageData.data
    visited.fill(0)
    mask.fill(0)
    largestColumns.fill(0)

    for (let index = 0; index < size; index += 1) {
      const pixel = index * 4
      const red = pixels[pixel]
      const green = pixels[pixel + 1]
      const blue = pixels[pixel + 2]
      if (green >= 45 && green >= red * 1.14 && green >= blue * 1.1 && green - red >= 14) {
        mask[index] = 1
      }
    }

    let largestComponent = null
    for (let index = 0; index < size; index += 1) {
      if (!mask[index] || visited[index]) continue

      componentColumns.fill(0)
      let head = 0
      let tail = 0
      let minX = width
      let maxX = -1
      let minY = height
      let maxY = -1
      queue[tail++] = index
      visited[index] = 1

      while (head < tail) {
        const current = queue[head++]
        const x = current % width
        const y = Math.floor(current / width)
        componentColumns[x] += 1
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)

        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue
            const neighborX = x + dx
            const neighborY = y + dy
            if (neighborX < 0 || neighborX >= width || neighborY < 0 || neighborY >= height) continue
            const neighbor = neighborY * width + neighborX
            if (visited[neighbor] || !mask[neighbor]) continue
            visited[neighbor] = 1
            queue[tail++] = neighbor
          }
        }
      }

      if (!largestComponent || tail > largestComponent.area) {
        largestComponent = { area: tail, minX, maxX, minY, maxY }
        largestColumns.set(componentColumns)
      }
    }

    if (!largestComponent || largestComponent.area < 10) return null
    const boxWidth = largestComponent.maxX - largestComponent.minX + 1
    const boxHeight = largestComponent.maxY - largestComponent.minY + 1
    if (boxWidth < 7 || boxWidth < boxHeight * 1.05) return null

    const edgeWidth = Math.max(2, Math.floor(boxWidth * 0.12))
    let leftEdgePixels = 0
    let rightEdgePixels = 0
    for (let offset = 0; offset < edgeWidth; offset += 1) {
      leftEdgePixels += largestColumns[largestComponent.minX + offset]
      rightEdgePixels += largestColumns[largestComponent.maxX - offset]
    }
    const edgeDifference = Math.abs(leftEdgePixels - rightEdgePixels)
    if (edgeDifference < Math.max(1, Math.max(leftEdgePixels, rightEdgePixels) * 0.16)) return null
    return leftEdgePixels > rightEdgePixels ? 'right' : 'left'
  }
}
