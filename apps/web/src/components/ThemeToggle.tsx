import { MonitorIcon, MoonIcon, SunIcon } from '@phosphor-icons/react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { useDarkMode, type Theme } from '@/hooks/useDarkMode'

const CYCLE: Theme[] = ['system', 'light', 'dark']

const ICONS: Record<Theme, React.ReactNode> = {
	system: <MonitorIcon weight="thin" />,
	light: <SunIcon weight="thin" />,
	dark: <MoonIcon weight="thin" />,
}

const LABELS: Record<Theme, string> = {
	system: 'System theme',
	light: 'Light mode',
	dark: 'Dark mode',
}

export function ThemeToggle() {
	const { theme, setTheme } = useDarkMode()

	const next = () => {
		const idx = CYCLE.indexOf(theme)
		setTheme(CYCLE[(idx + 1) % CYCLE.length])
	}

	return (
		<Button aria-label={LABELS[theme]} size="icon-sm" variant="ghost" onClick={next}>
			{ICONS[theme]}
		</Button>
	)
}
