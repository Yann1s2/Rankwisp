// Explicitly fictional product illustration. Never loaded into an authenticated account.
export function demoWorkspace() {
  const base = Date.UTC(2026, 10, 17, 12);
  const curves = [
    [24, 23, 24, 20, 21, 18, 19, 16, 14, 15, 11, 9, 10, 8],
    [11, 12, 10, 11, 10, 9, 10, 8, 9, 7, 8, 6, 7, 6],
    [38, 37, 34, 35, 32, 30, 31, 29, 27, 28, 24, 23, 22, 21],
    [7, 8, 8, 7, 6, 7, 6, 7, 6, 6, 5, 6, 5, 5],
  ];
  return {
    schemaVersion: 1,
    automaticUpdates: false,
    projects: [
      {
        id: "demo",
        appleID: 100000001,
        name: "Daylight",
        country: "us",
        archived: false,
        metadata: {
          name: "Daylight",
          developer: "Illustrative app",
          genre: "Productivity",
        },
        competitors: [
          { id: 100000002, name: "Daily Ritual", genre: "Productivity" },
          { id: 100000003, name: "Small Steps", genre: "Productivity" },
        ],
        keywords: [
          "daily planner",
          "habit tracker",
          "morning routine",
          "focus timer",
        ].map((text, k) => ({
          id: "demo-" + k,
          text,
          category: "core",
          archived: false,
          samples: curves[k].map((rank, i) => ({
            id: k + "-" + i,
            date: new Date(base - (13 - i) * 86400000).toISOString(),
            rank,
            resultCount: 200,
            source: "illustration",
            results: [
              { id: 100000002, name: "Daily Ritual" },
              ...Array.from({ length: rank - 2 }, (_, j) => ({
                id: 200000000 + j,
                name: "Example app",
              })),
              { id: 100000001, name: "Daylight" },
              { id: 100000003, name: "Small Steps" },
            ],
          })),
        })),
      },
    ],
  };
}
