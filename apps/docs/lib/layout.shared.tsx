import Image from "next/image"
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"
import { appName, gitConfig } from "./shared"

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      // JSX supported
      title: (
        <span className="flex items-center gap-2 font-semibold">
          <Image src="/logo.svg" alt="" width={24} height={24} priority />
          {appName}
        </span>
      ),
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  }
}
