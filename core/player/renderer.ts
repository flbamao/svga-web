import Player from '../player/index'
import render from './offscreen.canvas.render'

export default class Renderer {
  private _player: Player
  private _bitmapCache: { [key: string]: HTMLImageElement } = {}
  private _audioCache: { [key: string]: HTMLAudioElement } = {}
  private _dynamicElements: { [key: string]: DynamicElement } = {}
  // ImageData
  // private _frames: {[key: string]: ImageData} = {}
  private _frames: { [key: string]: HTMLImageElement | ImageBitmap } = {}
  private _ofsCanvas: HTMLCanvasElement | OffscreenCanvas

  constructor (player: Player) {
    this._player = player
    const container = this._player.container
    this._ofsCanvas = window.OffscreenCanvas ? new window.OffscreenCanvas(container.width, container.height) : document.createElement('canvas')
  }

  public prepare () {
    return new Promise<void>((resolve, reject) => {
      this._bitmapCache = {}
      this._audioCache = {}

      if (!this._player.videoItem.images || Object.keys(this._player.videoItem.images).length == 0) {
        resolve()
        return void 0
      }

      if (this._player.videoItem.dynamicElements) {
        this._dynamicElements = this._player.videoItem.dynamicElements
      }

      let totalCount = 0
      let loadedCount = 0

      for (let imageKey in this._player.videoItem.images) {
        const src = this._player.videoItem.images[imageKey]

        if (typeof src === 'string') {
          if (src.indexOf('iVBO') === 0 || src.indexOf('/9j/2w') === 0) {
            totalCount++

            const img = document.createElement('img')

            img.src = 'data:image/png;base64,' + src

            this._bitmapCache[imageKey] = img

            img.onload = () => {
              loadedCount++
              loadedCount === totalCount && resolve()
            }
          } else if (src.indexOf('SUQz') === 0) {
            const audio = new Audio(
              navigator.vendor === 'Google Inc.' ? URL.createObjectURL(Renderer.dataURLtoBlob('audio/x-mpeg', src)) : 'data:audio/x-mpeg;base64,' + src
            )
            audio.load()
            this._audioCache[imageKey] = audio
          }
        } else {
          this._bitmapCache[imageKey] = src
        }
      }
    })
  }

  public clear () {
    this._player.container.width = this._player.container.width
  }

  public drawFrame (frame: number) {
    const player = this._player
    if (player.intersectionObserverRender && !player.intersectionObserverRenderShow) {
      return
    }

    this.clear()

    const context2d = player.container.getContext('2d')!!

    if (this._player.cacheFrames && this._frames[frame]) {
      const ofsFrame = this._frames[frame]
      // ImageData
      // context.putImageData(ofsFrame, 0, 0)
      context2d.drawImage(ofsFrame, 0, 0, ofsFrame.width, ofsFrame.height, 0, 0, ofsFrame.width, ofsFrame.height)
      return
    }

    const ofsCanvas = this._ofsCanvas

    ofsCanvas.width = this._player.container.width
    ofsCanvas.height = this._player.container.height

    render(
      ofsCanvas,
      this._bitmapCache,
      this._dynamicElements,
      this._player.videoItem,
      this._player.currentFrame
    )

    context2d.drawImage(
      ofsCanvas,
      0, 0, ofsCanvas.width, ofsCanvas.height,
      0, 0, ofsCanvas.width, ofsCanvas.height
    )

    if (this._player.cacheFrames) {
      // ImageData
      // const imageData = (ofsCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D).getImageData(0, 0, ofsCanvas.width, ofsCanvas.height)
      // this._frames[frame] = imageData
      if ('toDataURL' in ofsCanvas) {
        const ofsImageBase64 = ofsCanvas.toDataURL()
        const ofsImage = new Image()
        ofsImage.src = ofsImageBase64
        this._frames[frame] = ofsImage
      } else {
        this._frames[frame] = ofsCanvas.transferToImageBitmap()
      }
    }
  }

  public playAudio () {
    if (this._player.playMode !== 'forwards') {
      return
    }

    for (const key in this._audioCache) {
      const audio = this._audioCache[key]
      audio.currentTime = 0
      audio.play()
    }
  }

  public stopAudio () {
    for (const key in this._audioCache) {
      const audio = this._audioCache[key]
      audio.pause()
      audio.currentTime = 0
    }
  }

  private static dataURLtoBlob (mimeType, base64Str) {
    const bstr = atob(base64Str)
    let n = bstr.length
    const u8arr = new Uint8Array(n)

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }

    return new Blob([u8arr], { type: mimeType })
  }
}
