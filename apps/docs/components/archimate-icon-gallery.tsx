import {
  SYSTEM_ARCHIMATE_ICONS,
  layerForArchimateType,
} from "@workspace/image-library"

export function ArchimateIconGallery() {
  const byLayer = new Map<string, typeof SYSTEM_ARCHIMATE_ICONS>()
  for (const icon of SYSTEM_ARCHIMATE_ICONS) {
    const layer = layerForArchimateType(icon.archimateType)
    const list = byLayer.get(layer) ?? []
    list.push(icon)
    byLayer.set(layer, list)
  }

  return (
    <div className="not-prose flex flex-col gap-6">
      {[...byLayer.entries()].map(([layer, icons]) => (
        <div key={layer}>
          <h3 className="text-fd-muted-foreground mb-2 text-sm font-semibold">
            {layer}
          </h3>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {icons.map((icon) => (
              <div
                key={icon.slug}
                title={icon.archimateType}
                className="border-fd-border flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center"
              >
                <span
                  className="text-fd-foreground size-8"
                  // Trusted, build-time-generated SVG — see
                  // apps/server/scripts/generate-archimate-icon-pack.ts.
                  dangerouslySetInnerHTML={{ __html: icon.svg }}
                />
                <span className="text-fd-muted-foreground text-xs">
                  {icon.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
