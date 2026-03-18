import { NextResponse } from 'next/server'

const PLATFORM_PRESETS = {
  "FeetFinder":        { w: 1080, h: 1080, mode: "cover", description: "Vierkant profiel (1080x1080)" },
  "FeetFinder_Banner": { w: 1500, h: 500,  mode: "cover", description: "Banner (1500x500)" },
  "OnlyFans":          { w: 1080, h: 1350, mode: "cover", description: "Portret (1080x1350)" },
  "OnlyFans_Cover":    { w: 1600, h: 400,  mode: "cover", description: "Cover foto (1600x400)" },
  "Instagram_Post":    { w: 1080, h: 1080, mode: "cover", description: "Instagram post (1080x1080)" },
  "Instagram_Story":   { w: 1080, h: 1920, mode: "cover", description: "Instagram story (1080x1920)" },
  "Twitter":           { w: 1200, h: 675,  mode: "cover", description: "Twitter/X post (1200x675)" },
  "Patreon":           { w: 1600, h: 400,  mode: "cover", description: "Patreon cover (1600x400)" },
  "Fansly":            { w: 1080, h: 1080, mode: "cover", description: "Fansly post (1080x1080)" },
}

export async function GET() {
  return NextResponse.json({ platforms: Object.keys(PLATFORM_PRESETS), presets: PLATFORM_PRESETS })
}
