export const HANDLE_HOVER_CSS = (
  <style>{`.react-flow__node:hover .react-flow__handle { opacity: 0.85 !important; }`}</style>
)

export const MARKER_DEFS = (
  <svg
    style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    aria-hidden
  >
    <defs>
      <marker
        id="archi-diamond-filled"
        viewBox="0 0 14 10"
        refX="0"
        refY="5"
        markerWidth="14"
        markerHeight="10"
        orient="auto-start-reverse"
        markerUnits="userSpaceOnUse"
      >
        <path d="M0,5 L7,0 L14,5 L7,10 Z" fill="#222" stroke="#222" />
      </marker>
      <marker
        id="archi-diamond-open"
        viewBox="0 0 14 10"
        refX="0"
        refY="5"
        markerWidth="14"
        markerHeight="10"
        orient="auto-start-reverse"
        markerUnits="userSpaceOnUse"
      >
        <path d="M0,5 L7,0 L14,5 L7,10 Z" fill="#fff" stroke="#222" />
      </marker>
      <marker
        id="archi-triangle-open"
        viewBox="0 0 12 10"
        refX="11"
        refY="5"
        markerWidth="12"
        markerHeight="10"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <path d="M0,0 L12,5 L0,10 Z" fill="#fff" stroke="#222" />
      </marker>
      <marker
        id="archi-arrow-filled"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="10"
        markerHeight="10"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <path d="M0,0 L10,5 L0,10 Z" fill="#222" stroke="#222" />
      </marker>
      <marker
        id="archi-arrow-open"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="10"
        markerHeight="10"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <path
          d="M0,0 L10,5 L0,10"
          fill="none"
          stroke="#222"
          strokeWidth="1.2"
        />
      </marker>
      <marker
        id="archi-dot-filled"
        viewBox="0 0 16 16"
        refX="9"
        refY="8"
        markerWidth="16"
        markerHeight="16"
        orient="auto-start-reverse"
        markerUnits="userSpaceOnUse"
      >
        <circle
          cx="7"
          cy="8"
          r="7"
          fill="#000"
          stroke="#fff"
          strokeWidth="1.5"
        />
      </marker>
    </defs>
  </svg>
)
