interface MenuIconProps {
  label: string
  expanded?: boolean
  controls?: string
  onClick: Kiru.MouseEventHandler<HTMLButtonElement>
  buttonClass?: string
  iconClass?: string
  style?: Record<string, string>
}

export function MenuIcon({ label, expanded, controls, onClick, buttonClass, iconClass, style }: MenuIconProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={expanded ? "true" : "false"}
      aria-controls={controls}
      data-menu-trigger={controls ?? ""}
      onclick={onClick}
      className={buttonClass ?? "flex items-center"}
      style={style}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        className={iconClass ?? "cursor-pointer w-4 h-4 text-[#767676] dark:text-[#9c9c9c] hover:text-blue-500 transition-color duration-300"}
      >
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </svg>
    </button>
  )
}
