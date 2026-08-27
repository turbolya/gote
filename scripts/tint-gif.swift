// Recolour a white-artwork animated GIF to a solid brand colour, frame by
// frame, preserving alpha, per-frame delays and the loop count.
//
//   swift scripts/tint-gif.swift assets/gote-spinner.gif \
//         assets/gote-spinner-teal.gif 008AAC
//
// This exists because iOS cannot tint an animated image at runtime: Image's
// tintColor templates one CGImage, and a GIF is a stack of them, so the tint
// silently does nothing. The teal spinner therefore has to be a second asset —
// regenerate it with the line above whenever gote-spinner.gif changes (the
// artwork itself comes from assets/gote spinner.aep).
//
// Multiply rather than replace, so the artwork's own shading survives:
// white -> the colour, mid-grey -> a darker shade of it, transparent stays
// transparent.
import Foundation
import ImageIO
import CoreGraphics
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count == 4 else { fputs("usage: tint.swift in.gif out.gif RRGGBB\n", stderr); exit(2) }
let inURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])
let hex = UInt32(args[3], radix: 16)!
let tr = CGFloat((hex >> 16) & 0xFF) / 255.0
let tg = CGFloat((hex >> 8) & 0xFF) / 255.0
let tb = CGFloat(hex & 0xFF) / 255.0

guard let src = CGImageSourceCreateWithURL(inURL as CFURL, nil) else { fputs("cannot read\n", stderr); exit(1) }
let count = CGImageSourceGetCount(src)
let srcProps = CGImageSourceCopyProperties(src, nil) as? [CFString: Any] ?? [:]
let srcGif = srcProps[kCGImagePropertyGIFDictionary] as? [CFString: Any] ?? [:]
let loop = srcGif[kCGImagePropertyGIFLoopCount] as? Int ?? 0

guard let dest = CGImageDestinationCreateWithURL(outURL as CFURL, UTType.gif.identifier as CFString, count, nil) else {
  fputs("cannot write\n", stderr); exit(1)
}
CGImageDestinationSetProperties(dest, [
  kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: loop]
] as CFDictionary)

let space = CGColorSpaceCreateDeviceRGB()
for i in 0..<count {
  guard let frame = CGImageSourceCreateImageAtIndex(src, i, nil) else { continue }
  let w = frame.width, h = frame.height
  var buf = [UInt8](repeating: 0, count: w * h * 4)
  buf.withUnsafeMutableBytes { raw in
    let ctx = CGContext(data: raw.baseAddress, width: w, height: h, bitsPerComponent: 8,
                        bytesPerRow: w * 4, space: space,
                        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.draw(frame, in: CGRect(x: 0, y: 0, width: w, height: h))
  }
  // Premultiplied, so scaling RGB by a factor <= 1 keeps R,G,B <= A.
  for p in stride(from: 0, to: buf.count, by: 4) {
    buf[p]     = UInt8((CGFloat(buf[p])     * tr).rounded())
    buf[p + 1] = UInt8((CGFloat(buf[p + 1]) * tg).rounded())
    buf[p + 2] = UInt8((CGFloat(buf[p + 2]) * tb).rounded())
  }
  let data = Data(buf)
  let provider = CGDataProvider(data: data as CFData)!
  let out = CGImage(width: w, height: h, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: w * 4,
                    space: space, bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
                    provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)!
  let fProps = CGImageSourceCopyPropertiesAtIndex(src, i, nil) as? [CFString: Any] ?? [:]
  let fGif = fProps[kCGImagePropertyGIFDictionary] as? [CFString: Any] ?? [:]
  var gif: [CFString: Any] = [:]
  if let d = fGif[kCGImagePropertyGIFUnclampedDelayTime] { gif[kCGImagePropertyGIFUnclampedDelayTime] = d }
  if let d = fGif[kCGImagePropertyGIFDelayTime] { gif[kCGImagePropertyGIFDelayTime] = d }
  CGImageDestinationAddImage(dest, out, [kCGImagePropertyGIFDictionary: gif] as CFDictionary)
}
guard CGImageDestinationFinalize(dest) else { fputs("finalize failed\n", stderr); exit(1) }
print("wrote \(count) frames, loop \(loop)")
