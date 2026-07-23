import Papa from 'papaparse'

// SwingVision CSV columns:
// Point, Game, Set, Shot, Type, Player, Stroke, Result, Direction, Spin,
// Speed (MPH), Hit (x), Hit (y), Hit (z), Bounce (x), Bounce (y),
// Bounce Zone, Bounce Side, Hit Zone, Video Time

export function parseSwingVisionCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      transformHeader: (h) => h.trim(),
      complete: ({ data, errors }) => {
        if (errors.length && !data.length) {
          reject(new Error(errors[0].message))
          return
        }
        try {
          resolve(normalizeShots(data))
        } catch (e) {
          reject(e)
        }
      },
      error: reject,
    })
  })
}

function normalizeShots(rows) {
  return rows
    .filter((r) => r['Shot'] != null)
    .map((r) => ({
      point: r['Point'],
      game: r['Game'],
      set: r['Set'],
      shot: r['Shot'],
      type: r['Type'] ?? '',
      player: r['Player'] ?? '',
      stroke: r['Stroke'] ?? '',
      result: r['Result'] ?? '',
      direction: r['Direction'] ?? '',
      spin: r['Spin'] ?? '',
      speedMph: r['Speed (MPH)'] ?? null,
      hit: {
        x: r['Hit (x)'] ?? null,
        y: r['Hit (y)'] ?? null,
        z: r['Hit (z)'] ?? null,
      },
      bounce: {
        x: r['Bounce (x)'] ?? null,
        y: r['Bounce (y)'] ?? null,
      },
      bounceZone: r['Bounce Zone'] ?? '',
      bounceSide: r['Bounce Side'] ?? '',
      hitZone: r['Hit Zone'] ?? '',
      videoTime: r['Video Time'] ?? null,
    }))
}
