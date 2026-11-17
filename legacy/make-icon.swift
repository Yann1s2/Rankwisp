import AppKit
let folder = URL(fileURLWithPath: CommandLine.arguments[1])
try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
for size in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let pixels = size * scale
        let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
        NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
        let context = NSGraphicsContext.current!.cgContext
        context.scaleBy(x: CGFloat(pixels) / 1024, y: CGFloat(pixels) / 1024)
        let rect = NSRect(x: 48, y: 48, width: 928, height: 928)
        let shape = NSBezierPath(roundedRect: rect, xRadius: 205, yRadius: 205)
        NSGradient(starting: NSColor(red: 43/255, green: 45/255, blue: 66/255, alpha: 1), ending: NSColor(red: 141/255, green: 153/255, blue: 174/255, alpha: 1))!.draw(in: shape, angle: -60)
        NSColor(red: 237/255, green: 242/255, blue: 244/255, alpha: 1).withAlphaComponent(0.08).setStroke()
        for y in [300, 500, 700] {
            let line = NSBezierPath(); line.move(to: .init(x: 220, y: y)); line.line(to: .init(x: 810, y: y)); line.lineWidth = 4; line.stroke()
        }
        let graph = NSBezierPath(); graph.move(to: .init(x: 225, y: 310)); graph.line(to: .init(x: 405, y: 490)); graph.line(to: .init(x: 540, y: 420)); graph.line(to: .init(x: 785, y: 715))
        graph.lineWidth = 57; graph.lineCapStyle = .round; graph.lineJoinStyle = .round
        NSColor(red: 239/255, green: 35/255, blue: 60/255, alpha: 1).setStroke(); graph.stroke()
        NSColor(red: 237/255, green: 242/255, blue: 244/255, alpha: 1).setFill(); NSBezierPath(ovalIn: NSRect(x: 744, y: 674, width: 82, height: 82)).fill()
        NSGraphicsContext.restoreGraphicsState()
        let name = "icon_\(size)x\(size)\(scale == 2 ? "@2x" : "").png"
        try bitmap.representation(using: .png, properties: [:])!.write(to: folder.appendingPathComponent(name))
    }
}
