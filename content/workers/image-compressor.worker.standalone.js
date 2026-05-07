/**
 * 图片压缩 Worker（独立文件版本）
 * 使用 OffscreenCanvas 在后台线程进行压缩
 */

self.onmessage = async function (e) {
  const { id, src, quality, maxWidth, maxHeight, priority, isCors } = e.data

  try {
    let blob

    // 跨域处理：使用 fetch 获取 blob
    if (isCors) {
      const response = await fetch(src, { mode: 'cors', credentials: 'omit' })
      if (!response.ok) {
        throw new Error('cors_fetch_failed: ' + response.status)
      }
      blob = await response.blob()
    } else {
      // 同源直接 fetch
      const response = await fetch(src)
      if (!response.ok) {
        throw new Error('fetch failed: ' + response.status)
      }
      blob = await response.blob()
    }

    // 创建 ImageBitmap
    const imageBitmap = await createImageBitmap(blob)

    // 计算目标尺寸
    let width = imageBitmap.width
    let height = imageBitmap.height
    if (maxWidth > 0 && (width > maxWidth || height > maxHeight)) {
      const ratio = Math.min(maxWidth / width, maxHeight / height)
      width = Math.floor(width * ratio)
      height = Math.floor(height * ratio)
    }

    // 使用 OffscreenCanvas 压缩
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(imageBitmap, 0, 0, width, height)

    // 导出为 Blob (优先 webp，不支持时回退 jpeg)
    let compressedBlob
    try {
      compressedBlob = await canvas.convertToBlob({
        type: 'image/webp',
        quality: quality,
      })
    } catch {
      compressedBlob = await canvas.convertToBlob({
        type: 'image/jpeg',
        quality: quality,
      })
    }

    // 返回结果
    const reader = new FileReader()
    reader.onload = () => {
      self.postMessage({
        id,
        success: true,
        dataUrl: reader.result,
        originalSize: blob.size,
        compressedSize: compressedBlob.size,
        priority,
      })
    }
    reader.onerror = () => {
      self.postMessage({ id, success: false, error: 'FileReader error' })
    }
    reader.readAsDataURL(compressedBlob)
  } catch (error) {
    self.postMessage({ id, success: false, error: error.message, priority })
  }
}
