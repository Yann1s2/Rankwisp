import SwiftUI

enum Theme {
    static let ink = Color(red: 43/255, green: 45/255, blue: 66/255)
    static let muted = Color(red: 141/255, green: 153/255, blue: 174/255)
    static let paper = Color(red: 237/255, green: 242/255, blue: 244/255)
    static let red = Color(red: 239/255, green: 35/255, blue: 60/255)
    static let crimson = Color(red: 216/255, green: 0, blue: 50/255)
    static let secondary = ink.opacity(0.65)
    static func font(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        .custom(weight == .bold ? "AvenirNext-Bold" : weight == .semibold ? "AvenirNext-DemiBold" : weight == .medium ? "AvenirNext-Medium" : "AvenirNext-Regular", size: size)
    }
}

struct PillStyle: ButtonStyle {
    var dark = false
    var compact = false
    @Environment(\.isEnabled) private var enabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(Theme.font(compact ? 11 : 12, .medium))
            .padding(.horizontal, compact ? 14 : 20).padding(.vertical, compact ? 8 : 12)
            .foregroundStyle(dark ? Theme.paper : Theme.ink)
            .background(dark ? Theme.ink : Theme.muted.opacity(0.12), in: Capsule())
            .opacity(enabled ? (configuration.isPressed ? 0.7 : 1) : 0.45)
    }
}

struct IconControl: View {
    let symbol: String
    let label: String
    var active = false
    var size: CGFloat = 38
    let action: () -> Void
    @State private var hovered = false
    var body: some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: size > 40 ? 17 : 14))
                .foregroundStyle(active ? Theme.red : Theme.ink)
                .frame(width: size, height: size)
                .background(active ? Theme.ink : hovered ? Theme.muted.opacity(0.15) : Theme.paper.opacity(0), in: Circle())
                .contentShape(Circle())
        }.buttonStyle(.plain).help(label).accessibilityLabel(label).onHover { hovered = $0 }
    }
}

struct Surface: ViewModifier {
    var dark = false
    var padding: CGFloat = 22
    func body(content: Content) -> some View {
        content.padding(padding).frame(maxWidth: .infinity, alignment: .leading)
            .background(dark ? Theme.ink : Theme.paper, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
            .shadow(color: Theme.ink.opacity(dark ? 0 : 0.025), radius: 16, x: 0, y: 5)
    }
}
extension View {
    func surface(dark: Bool = false, padding: CGFloat = 22) -> some View { modifier(Surface(dark: dark, padding: padding)) }
}
