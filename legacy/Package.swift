// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "Rankblick",
    platforms: [.macOS(.v14)],
    products: [.executable(name: "Rankblick", targets: ["Rankblick"]), .executable(name: "RankblickWorker", targets: ["RankblickWorker"])],
    targets: [
        .target(name: "RankblickCore", resources: [.copy("Resources/seed.json")]),
        .executableTarget(name: "Rankblick", dependencies: ["RankblickCore"]),
        .executableTarget(name: "RankblickWorker", dependencies: ["RankblickCore"]),
        .testTarget(name: "RankblickCoreTests", dependencies: ["RankblickCore"])
    ],
    swiftLanguageModes: [.v5]
)
