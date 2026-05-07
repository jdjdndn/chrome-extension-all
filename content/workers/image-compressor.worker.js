/**
 * 图片压缩 Worker
 * 使用 OffscreenCanvas 在后台线程进行压缩
 * 避免阻塞主线程
 */

self.onmessage = async function (e) {
  const { id, src, quality, maxWidth, maxHeight } = e.data

  try {
    // 1. 获取图片数据
    const response = await fetch(src)
    if (!response.ok) {
      throw new Error(`fetch failed: ${response.status}`)
    }
    const blob = await response.blob()

    // 2. 创建 ImageBitmap
    const imageBitmap = await createImageBitmap(blob)

    // 3. 计算目标尺寸
    let width = imageBitmap.width
    let height = imageBitmap.height
    if (maxWidth > 0 && (width > maxWidth || height > maxHeight)) {
      const ratio = Math.min(maxWidth / width, maxHeight / height)
      width = Math.floor(width * ratio)
      height = Math.floor(height * ratio)
    }

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
      })
    }
    reader.onerror = () => {
      self.postMessage({
        id,
        success: false,
        error: 'FileReader error',
      })
    }
    reader.readAsDataURL(compressedBlob)
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error.message,
    })
  }
}
