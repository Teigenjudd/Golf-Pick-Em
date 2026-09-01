import { useState, useEffect, useCallback } from 'react'
import Cropper from 'react-easy-crop'

const MIN_ZOOM = 0.5
// Avatars never render bigger than a few dozen px on screen, so the export is
// capped here rather than kept at the source photo's full resolution -- a
// phone photo would otherwise become a multi-MB upload for a coin-sized
// circle, and at extreme zoom-out on a large image could bust the bucket's
// 5MB cap after the modal's already closed. Math.min so a crop smaller than
// this never gets upscaled.
const EXPORT_SIZE = 512

// Renders the crop region onto a canvas and exports it as a JPEG blob --
// standard react-easy-crop recipe. crossOrigin isn't needed since imageSrc is
// always a local blob: URL (URL.createObjectURL on the just-picked file), not
// a remote image, so canvas export never hits a tainted-canvas CORS error.
//
// Zooming below 1 (MIN_ZOOM) lets the photo sit smaller than the crop circle,
// so cropPixels can extend past the image's actual bounds. drawImage only
// paints the portion that overlaps the source image and leaves the rest of
// the canvas untouched -- which for a JPEG (no alpha channel) would otherwise
// encode as black. Filling white first turns that empty margin into a clean
// white background instead.
function getCroppedBlob(imageSrc, cropPixels) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const size = Math.min(cropPixels.width, cropPixels.height, EXPORT_SIZE)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(
        image,
        cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height,
        0, 0, canvas.width, canvas.height,
      )
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Could not crop that image.')); return }
        resolve(blob)
      }, 'image/jpeg', 0.92)
    }
    image.onerror = () => reject(new Error('Could not load that image.'))
    image.src = imageSrc
  })
}

// A minimal crop step between "picked a file" and "upload it" -- drag to
// reposition, slider to zoom, fixed 1:1 circular guide since every avatar
// renders in a circle. onCropped receives a ready-to-upload JPEG Blob;
// uploadAvatarForUser (lib/profile.js) accepts a Blob the same as a File, so
// no changes were needed there.
export default function AvatarCropModal({ file, onCancel, onCropped }) {
  // Create + revoke inside the SAME effect invocation, not a useState
  // initializer paired with a separate cleanup-only effect -- under
  // StrictMode's dev-only double-invoke (mount -> cleanup -> mount again),
  // that split revoked the URL before the second mount, leaving the image
  // pointed at a dead blob URL (renders as nothing, just the container's
  // background). This pattern creates a fresh URL on each invocation.
  const [imageSrc, setImageSrc] = useState(null)
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImageSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedPixels, setCroppedPixels] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleCropComplete = useCallback((_area, areaPixels) => {
    setCroppedPixels(areaPixels)
  }, [])

  async function handleSave() {
    if (!croppedPixels) return
    setSaving(true)
    setError(null)
    try {
      const blob = await getCroppedBlob(imageSrc, croppedPixels)
      onCropped(blob)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-[360px]">
        <div className="relative w-full h-[320px] bg-charcoal">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            minZoom={MIN_ZOOM}
            maxZoom={3}
            aspect={1}
            cropShape="round"
            showGrid={false}
            restrictPosition={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        <div className="p-4">
          <input
            type="range"
            min={MIN_ZOOM}
            max={3}
            step={0.01}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="w-full"
          />
          {error && <p className="text-[12px] text-birdie mt-2 mb-0">{error}</p>}
          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex-1 border border-warm-300 text-charcoal hover:bg-warm-100 py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !croppedPixels}
              className="flex-1 bg-brand text-white font-bold text-[14px] py-2.5 px-4 rounded-lg border-none cursor-pointer disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
