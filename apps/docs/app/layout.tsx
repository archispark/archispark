import { RootProvider } from "fumadocs-ui/provider/next"
import type { Metadata } from "next"
import "./global.css"

export const metadata: Metadata = {
  title: { default: "ArchiSpark", template: "%s | ArchiSpark" },
  description:
    "ArchiMate 3.1 modelling platform with a REST API and MCP server.",
  icons: { icon: "/favicon.svg" },
}

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider theme={{ defaultTheme: "system", enableSystem: true }}>
          {children}
        </RootProvider>
      </body>
    </html>
  )
}
