/**
 * 图片压缩 Worker
 * 使用 OffscreenCanvas 在后台线程进行压缩
 * 避免阻塞主线程
 */

self.onmessage = async function (e) {
  const { type, id, src, quality, maxWidth, maxHeight, priority, isCors } = e.data

  // 处理心跳ping
  if (type === 'ping') {
    self.postMessage({ type: 'pong', id })
    return
  }

  try {
    // 1. 获取图片数据
    let blob
    if (isCors) {
      const response = await fetch(src, { mode: 'cors', credentials: 'omit' })
      if (!response.ok) {
        throw new Error(`cors_fetch_failed: ${response.status}`)
      }
      blob = await response.blob()
    } else {
      const response = await fetch(src)
      if (!response.ok) {
        throw new Error(`fetch failed: ${response.status}`)
      }
      blob = await response.blob()
    }

    // 2. 创建 ImageBitmap
    const imageBitmap = await createImageBitmap(blob)

    // 3. 保持原始尺寸
    const width = imageBitmap.width
    const height = imageBitmap.height

    // 4. 使用 OffscreenCanvas 压缩
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(imageBitmap, 0, 0, width, height)

    // 5. 导出为 Blob (优先使用webp，不支持时回退jpeg)
    let compressedBlob
    try {
      compressedBlob = await canvas.convertToBlob({
        type: 'image/webp',
        quality: quality,
      })
    } catch {
      // webp不支持时回退jpeg
      compressedBlob = await canvas.convertToBlob({
        type: 'image/jpeg',
        quality: quality,
      })
    }

    // 6. 返回结果（使用 FileReader 转为 dataUrl）
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
      self.postMessage({
        id,
        success: false,
        error: 'FileReader error',
        priority,
      })
    }
    reader.readAsDataURL(compressedBlob)
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error.message,
      priority,
    })
  }
}
