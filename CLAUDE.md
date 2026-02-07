# CLAUDE.md

## SQLAlchemy Model Conventions

- Always add `server_default=` when using `default=` - the `default` only applies in Python/ORM, while `server_default` ensures the database has the default value for raw SQL inserts
- Always specify `nullable=True` or `nullable=False` explicitly
- Always add max length to String fields (e.g., `String(64)` not just `String`)
- Use `DateTime(timezone=True)` for all datetime fields for consistency
- Don't add `index=True` on FK columns if a composite index starting with that column already exists (composite indexes can serve single-column lookups)

## Code Style

- Don't add comments or docstrings for self-explanatory code
- Let the code speak for itself - use clear variable/function names instead of comments

## Frontend UI/UX Guidelines

### Color Palette
- Always refer to `frontend/tailwind.config.js` for defined colors
- Never hardcode hex codes or use default Tailwind colors (`bg-gray-100`, `text-blue-600`, etc.)
- Every light color class must have a `dark:` counterpart
- Surface tokens: `surface-primary`, `surface-secondary` (most used), `surface-tertiary`, `surface-hover`, `surface-active` — dark variants are `surface-dark-*`
- Border tokens: `border-border` (default), `border-border-secondary`, `border-border-hover` — dark variants are `border-border-dark-*`
- Text tokens: `text-text-primary`, `text-text-secondary`, `text-text-tertiary`, `text-text-quaternary` — dark variants are `text-text-dark-*`
- Use `brand-600`/`brand-400` (dark) for links and interactive highlights only — prefer neutral tokens for structural elements
- Semantic colors (`success`, `error`, `warning`, `info`) are only for status indicators, not layout
- Use opacity modifiers sparingly for glassmorphism (`/50`, `/30` are common) — white/black only as opacity overlays (`bg-white/5`, `bg-black/50`), never solid

### Typography
- `text-xs` is the default for most UI, `text-sm` for primary labels and inputs, `text-2xs` for meta-data and section headers, `text-lg` for dialog titles only — avoid `text-base` and larger in dense UI
- `font-medium` is the standard for emphasis — use `font-semibold` only for dialog titles and section headers — avoid `font-bold` except for special display elements like auth codes
- Use `font-mono` for code snippets, URIs, package names, env vars, and technical identifiers — pair with `text-xs` or `text-sm`

### Borders & Radius
- Standard border pattern: `border border-border dark:border-border-dark` — use `border-border-secondary` for subtle dividers, `border-border-hover` for interactive hover states, `border-border/50` for very subtle borders
- Radius hierarchy: `rounded-md` for small elements (buttons, inputs), `rounded-lg` for standard containers and cards (most common), `rounded-xl` for prominent cards, `rounded-2xl` for dropdowns and overlays — button sizes follow `sm: rounded-md`, `md: rounded-lg`, `lg: rounded-xl`
- Shadow hierarchy: `shadow-sm` for interactive elements, `shadow-medium` for dropdowns and panels, `shadow-strong` for modals and prominent overlays — use `hover:shadow-md` for depth feedback on hover

### Icons
- Default icon size is `h-3.5 w-3.5` for toolbars, action buttons, and small controls
- Use `h-4 w-4` for message actions, form controls, and list icons
- Use `h-3 w-3` for text-adjacent icons, badges, and close buttons
- Use `h-5 w-5` or `h-6 w-6` for prominent empty states and loading indicators
- Icon color is `text-text-tertiary` by default, `text-text-primary` on hover/active

### Animations & Transitions
- Use `framer-motion` for state transitions (`AnimatePresence mode="wait"`, `motion.div` with `initial`/`animate`/`exit`) — common values: `opacity: 0→1`, `y: 5→0`, `scale: 0.98→1`
- Use `transition-colors duration-200` for hover/focus, `transition-all duration-300` for complex state changes like drag-and-drop
- Use `transition-[padding] duration-500 ease-in-out` for sidebar/layout animations
- Loading states: `animate-spin` for spinners, `animate-pulse` for skeletons, `animate-bounce` with staggered `animationDelay` for dot loaders
- Expandable content: `transition-all duration-200` with `max-h-*` and `opacity` toggling
