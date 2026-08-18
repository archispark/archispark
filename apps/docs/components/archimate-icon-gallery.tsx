import {
  ARCHIMATE_TYPE_ICONS,
  ARCHIMATE_TYPE_NAMES,
  layerForArchimateType,
} from "@workspace/image-library"

export function ArchimateIconGallery() {
  const types = Object.keys(ARCHIMATE_TYPE_ICONS)
  const byLayer = new Map<string, string[]>()
  for (const type of types) {
    const layer = layerForArchimateType(type)
    const list = byLayer.get(layer) ?? []
    list.push(type)
    byLayer.set(layer, list)
  }

  return (
    <div className="not-prose flex flex-col gap-6">
      {[...byLayer.entries()].map(([layer, layerTypes]) => (
        <div key={layer}>
          <h3 className="text-fd-muted-foreground mb-2 text-sm font-semibold">
            {layer}
          </h3>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {layerTypes.map((type) => {
              const Icon = ARCHIMATE_TYPE_ICONS[type]
              if (!Icon) return null
              return (
                <div
                  key={type}
                  title={type}
                  className="border-fd-border flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center"
                >
                  <Icon className="text-fd-foreground size-8" />
                  <span className="text-fd-muted-foreground text-xs">
                    {ARCHIMATE_TYPE_NAMES[type]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
